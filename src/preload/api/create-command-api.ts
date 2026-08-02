import {
  COMMAND_INVOKED_CHANNEL,
  COMMAND_UPDATE_STATES_CHANNEL,
  commandInvokedEventSchema,
  commandStateSyncRequestSchema,
  commandStateSyncResultSchema,
  IPC_CONTRACT_VERSION,
  requestIdSchema,
  type ApprovedIpcChannel,
  type CommandId,
  type CommandStateSyncResult,
  type LatticeDesktopApi
} from '../../shared/contracts'
import type { IpcSafeReason } from '../../shared/errors'

type CommandEventListener = (event: unknown, payload: unknown) => void

export interface CommandApiDependencies {
  readonly createRequestId: () => string
  readonly invoke: (channel: ApprovedIpcChannel, request: unknown) => Promise<unknown>
  readonly on: (channel: typeof COMMAND_INVOKED_CHANNEL, listener: CommandEventListener) => void
  readonly removeListener: (
    channel: typeof COMMAND_INVOKED_CHANNEL,
    listener: CommandEventListener
  ) => void
  readonly reportEventFailure: (reason: 'invalid_payload' | 'listener_threw') => void
}

function createLocalFailure(reason: IpcSafeReason, requestId?: string): CommandStateSyncResult {
  return commandStateSyncResultSchema.parse({
    ok: false,
    error: {
      code: 'INTERNAL_UNEXPECTED',
      messageKey: 'errors.internal.unexpected',
      retryable: false,
      safeDetails: { reason },
      ...(requestId === undefined ? {} : { requestId })
    }
  })
}

function safeReport(
  report: CommandApiDependencies['reportEventFailure'],
  reason: 'invalid_payload' | 'listener_threw'
): void {
  try {
    report(reason)
  } catch {
    // Diagnostics must not let invalid input reach the renderer listener.
  }
}

export function createCommandApi(
  dependencies: CommandApiDependencies
): LatticeDesktopApi['commands'] {
  return {
    onInvoke: (listener: (id: CommandId) => void): (() => void) => {
      const wrapped: CommandEventListener = (_event, payload) => {
        const parsed = commandInvokedEventSchema.safeParse(payload)
        if (!parsed.success) {
          safeReport(dependencies.reportEventFailure, 'invalid_payload')
          return
        }

        try {
          listener(parsed.data.id)
        } catch {
          safeReport(dependencies.reportEventFailure, 'listener_threw')
        }
      }
      dependencies.on(COMMAND_INVOKED_CHANNEL, wrapped)

      let subscribed = true
      return () => {
        if (!subscribed) return
        subscribed = false
        dependencies.removeListener(COMMAND_INVOKED_CHANNEL, wrapped)
      }
    },
    updateStates: async (states): Promise<CommandStateSyncResult> => {
      let requestIdCandidate: string
      try {
        requestIdCandidate = dependencies.createRequestId()
      } catch {
        return createLocalFailure('schema_invalid')
      }

      const requestIdResult = requestIdSchema.safeParse(requestIdCandidate)
      if (!requestIdResult.success) return createLocalFailure('schema_invalid')
      const requestId = requestIdResult.data
      const requestResult = commandStateSyncRequestSchema.safeParse({
        contractVersion: IPC_CONTRACT_VERSION,
        requestId,
        payload: { states }
      })
      if (!requestResult.success) return createLocalFailure('schema_invalid', requestId)

      let response: unknown
      try {
        response = await dependencies.invoke(COMMAND_UPDATE_STATES_CHANNEL, requestResult.data)
      } catch {
        return createLocalFailure('handler_threw', requestId)
      }

      const responseResult = commandStateSyncResultSchema.safeParse(response)
      if (!responseResult.success) return createLocalFailure('response_schema_invalid', requestId)
      if (!responseResult.data.ok && responseResult.data.error.requestId !== requestId) {
        return createLocalFailure('response_schema_invalid', requestId)
      }

      return responseResult.data
    }
  }
}
