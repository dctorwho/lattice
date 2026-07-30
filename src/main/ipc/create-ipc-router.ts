import { type z } from 'zod'

import {
  approvedIpcChannelSchema,
  IPC_CONTRACT_VERSION,
  requestIdSchema,
  type ApprovedIpcChannel
} from '../../shared/contracts'
import {
  appErrorSchema,
  createAppError,
  type ErrorCode,
  type IpcSafeReason,
  type Result,
  type SafeDetails
} from '../../shared/errors'
import { type AuthorizedWindowRegistry } from './authorized-window-registry'
import { createSafeStack, type IpcErrorLogEvent } from './ipc-error-logger'
import { validateIpcValue } from './ipc-value-budget'
import {
  validateIpcSender,
  type IpcSenderEvent,
  type ValidatedIpcContext
} from './validate-ipc-sender'

export interface IpcRoute<TRequest, TValue> {
  readonly channel: ApprovedIpcChannel
  readonly requestSchema: z.ZodType<TRequest>
  readonly responseSchema: z.ZodType<Result<TValue>>
  readonly handle: (request: TRequest, context: ValidatedIpcContext) => Promise<Result<TValue>>
}

type RouteExecution =
  | { readonly kind: 'request_schema_invalid' }
  | { readonly kind: 'response_schema_invalid' }
  | { readonly kind: 'complete'; readonly value: unknown }

interface ErasedRoute {
  readonly channel: ApprovedIpcChannel
  readonly execute: (input: unknown, context: ValidatedIpcContext) => Promise<RouteExecution>
}

export interface IpcRouter<TSender extends object, TFrame extends object> {
  dispatch(
    channel: string,
    event: IpcSenderEvent<TSender, TFrame>,
    input: unknown
  ): Promise<unknown>
}

export interface IpcRouterOptions<TSender extends object> {
  readonly registry: AuthorizedWindowRegistry<TSender>
  readonly routes: readonly ErasedRoute[]
  readonly createRequestId: () => string
  readonly log: (event: IpcErrorLogEvent) => void
}

export function defineIpcRoute<TRequest, TValue>(route: IpcRoute<TRequest, TValue>): ErasedRoute {
  return {
    channel: route.channel,
    execute: async (input, context) => {
      const request = route.requestSchema.safeParse(input)
      if (!request.success) {
        return { kind: 'request_schema_invalid' }
      }

      const result = await route.handle(request.data, context)
      const response = route.responseSchema.safeParse(result)
      return response.success
        ? { kind: 'complete', value: response.data }
        : { kind: 'response_schema_invalid' }
    }
  }
}

function extractRequestId(input: unknown): string | undefined {
  if (typeof input !== 'object' || input === null) {
    return undefined
  }

  try {
    const descriptor = Object.getOwnPropertyDescriptor(input, 'requestId')
    if (descriptor === undefined || descriptor.get !== undefined || descriptor.set !== undefined) {
      return undefined
    }

    const parsed = requestIdSchema.safeParse(descriptor.value)
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

function extractMismatchedContractVersion(input: unknown): number | undefined {
  if (typeof input !== 'object' || input === null) {
    return undefined
  }

  try {
    const descriptor = Object.getOwnPropertyDescriptor(input, 'contractVersion')
    if (descriptor === undefined || descriptor.get !== undefined || descriptor.set !== undefined) {
      return undefined
    }

    const value: unknown = descriptor.value
    return typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 1_000 &&
      value !== IPC_CONTRACT_VERSION
      ? value
      : undefined
  } catch {
    return undefined
  }
}

function safeChannel(channel: string): ApprovedIpcChannel | 'unknown' {
  const parsed = approvedIpcChannelSchema.safeParse(channel)
  return parsed.success ? parsed.data : 'unknown'
}

function safeLog(log: (event: IpcErrorLogEvent) => void, event: IpcErrorLogEvent): void {
  try {
    log(event)
  } catch {
    // A diagnostic adapter must never replace the stable IPC response.
  }
}

interface FailureOptions {
  readonly code: ErrorCode
  readonly requestId: string
  readonly channel: ApprovedIpcChannel | 'unknown'
  readonly reason: IpcSafeReason
  readonly context?: ValidatedIpcContext
  readonly safeDetails?: SafeDetails
  readonly cause?: unknown
}

function createFailure(
  log: (event: IpcErrorLogEvent) => void,
  options: FailureOptions
): Result<never> {
  const safeDetails = options.safeDetails ?? { reason: options.reason }
  const error = appErrorSchema.parse(createAppError(options.code, options.requestId, safeDetails))
  const level: IpcErrorLogEvent['level'] =
    options.code === 'INTERNAL_UNEXPECTED' ? 'error' : 'warning'
  const safeStack = createSafeStack(options.cause)
  const baseEvent = {
    level,
    code: options.code,
    requestId: options.requestId,
    channel: options.channel,
    reason: options.reason
  } satisfies IpcErrorLogEvent
  const contextualEvent =
    options.context === undefined
      ? baseEvent
      : {
          ...baseEvent,
          windowId: options.context.windowId,
          webContentsId: options.context.webContentsId
        }
  const event: IpcErrorLogEvent =
    safeStack === undefined ? contextualEvent : { ...contextualEvent, safeStack }

  safeLog(log, event)
  return { ok: false, error }
}

export function createIpcRouter<TSender extends object, TFrame extends object>(
  options: IpcRouterOptions<TSender>
): IpcRouter<TSender, TFrame> {
  return {
    dispatch: async (channel, event, input) => {
      const requestId = extractRequestId(input) ?? options.createRequestId()
      const loggedChannel = safeChannel(channel)
      const sender = validateIpcSender(event, options.registry, requestId)
      if (!sender.ok) {
        return createFailure(options.log, {
          code: sender.error.code,
          requestId,
          channel: loggedChannel,
          reason: sender.reason
        })
      }

      const inputBudget = validateIpcValue(input)
      if (!inputBudget.ok) {
        return createFailure(options.log, {
          code: 'IPC_INVALID_REQUEST',
          requestId,
          channel: loggedChannel,
          reason: inputBudget.reason,
          context: sender.context
        })
      }

      const route = options.routes.find((candidate) => candidate.channel === channel)
      if (route === undefined) {
        return createFailure(options.log, {
          code: 'IPC_INVALID_REQUEST',
          requestId,
          channel: 'unknown',
          reason: 'unknown_channel',
          context: sender.context
        })
      }

      const receivedVersion = extractMismatchedContractVersion(input)
      if (receivedVersion !== undefined) {
        return createFailure(options.log, {
          code: 'APP_VERSION_MISMATCH',
          requestId,
          channel: route.channel,
          reason: 'contract_version_mismatch',
          context: sender.context,
          safeDetails: {
            reason: 'contract_version_mismatch',
            expectedVersion: IPC_CONTRACT_VERSION,
            receivedVersion
          }
        })
      }

      let execution: RouteExecution
      try {
        execution = await route.execute(input, sender.context)
      } catch (cause) {
        return createFailure(options.log, {
          code: 'INTERNAL_UNEXPECTED',
          requestId,
          channel: route.channel,
          reason: 'handler_threw',
          context: sender.context,
          cause
        })
      }

      if (execution.kind === 'request_schema_invalid') {
        return createFailure(options.log, {
          code: 'IPC_INVALID_REQUEST',
          requestId,
          channel: route.channel,
          reason: 'schema_invalid',
          context: sender.context
        })
      }

      if (execution.kind === 'response_schema_invalid') {
        return createFailure(options.log, {
          code: 'INTERNAL_UNEXPECTED',
          requestId,
          channel: route.channel,
          reason: 'response_schema_invalid',
          context: sender.context
        })
      }

      const responseBudget = validateIpcValue(execution.value)
      if (!responseBudget.ok) {
        return createFailure(options.log, {
          code: 'INTERNAL_UNEXPECTED',
          requestId,
          channel: route.channel,
          reason: responseBudget.reason,
          context: sender.context
        })
      }

      return execution.value
    }
  }
}
