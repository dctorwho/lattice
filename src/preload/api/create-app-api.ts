import {
  APP_GET_INFO_CHANNEL,
  WINDOW_CLOSE_DECISION_CHANNEL,
  WINDOW_CLOSE_REQUESTED_EVENT,
  appGetInfoResultSchema,
  IPC_CONTRACT_VERSION,
  requestIdSchema,
  windowCloseDecisionRequestSchema,
  windowCloseDecisionResultSchema,
  windowCloseRequestedEventSchema,
  type ApprovedIpcChannel,
  type AppGetInfoResult,
  type WindowCloseDecisionResult,
  type LatticeDesktopApi
} from '../../shared/contracts'
import type { IpcSafeReason } from '../../shared/errors'

export interface AppApiDependencies {
  readonly createRequestId: () => string
  readonly invoke: (channel: ApprovedIpcChannel, request: unknown) => Promise<unknown>
  readonly on?: (channel: typeof WINDOW_CLOSE_REQUESTED_EVENT, listener: AppEventListener) => void
  readonly removeListener?: (
    channel: typeof WINDOW_CLOSE_REQUESTED_EVENT,
    listener: AppEventListener
  ) => void
}

type AppEventListener = (event: unknown, payload: unknown) => void

function createLocalFailure(reason: IpcSafeReason, requestId?: string): AppGetInfoResult {
  return appGetInfoResultSchema.parse({
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

function createCloseLocalFailure(
  reason: IpcSafeReason,
  requestId?: string
): WindowCloseDecisionResult {
  return windowCloseDecisionResultSchema.parse({
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

export function createAppApi(dependencies: AppApiDependencies): LatticeDesktopApi['app'] {
  return {
    onCloseRequested: (listener): (() => void) => {
      if (dependencies.on === undefined || dependencies.removeListener === undefined)
        return () => {}
      const wrapped: AppEventListener = (_event, payload) => {
        if (!windowCloseRequestedEventSchema.safeParse(payload).success) return
        listener()
      }
      dependencies.on(WINDOW_CLOSE_REQUESTED_EVENT, wrapped)
      let subscribed = true
      return () => {
        if (!subscribed) return
        subscribed = false
        dependencies.removeListener?.(WINDOW_CLOSE_REQUESTED_EVENT, wrapped)
      }
    },
    confirmClose: async (decision): Promise<WindowCloseDecisionResult> => {
      let candidate: string
      try {
        candidate = dependencies.createRequestId()
      } catch {
        return createCloseLocalFailure('schema_invalid')
      }
      const requestId = requestIdSchema.safeParse(candidate)
      if (!requestId.success) return createCloseLocalFailure('schema_invalid')
      const request = windowCloseDecisionRequestSchema.safeParse({
        contractVersion: IPC_CONTRACT_VERSION,
        requestId: requestId.data,
        payload: { decision }
      })
      if (!request.success) return createCloseLocalFailure('schema_invalid', requestId.data)
      let response: unknown
      try {
        response = await dependencies.invoke(WINDOW_CLOSE_DECISION_CHANNEL, request.data)
      } catch {
        return createCloseLocalFailure('handler_threw', requestId.data)
      }
      const parsed = windowCloseDecisionResultSchema.safeParse(response)
      if (!parsed.success) return createCloseLocalFailure('response_schema_invalid', requestId.data)
      if (!parsed.data.ok && parsed.data.error.requestId !== requestId.data) {
        return createCloseLocalFailure('response_schema_invalid', requestId.data)
      }
      return parsed.data
    },
    getInfo: async (): Promise<AppGetInfoResult> => {
      let requestIdCandidate: string
      try {
        requestIdCandidate = dependencies.createRequestId()
      } catch {
        return createLocalFailure('schema_invalid')
      }

      const requestIdResult = requestIdSchema.safeParse(requestIdCandidate)
      if (!requestIdResult.success) {
        return createLocalFailure('schema_invalid')
      }
      const requestId = requestIdResult.data
      const request = {
        contractVersion: IPC_CONTRACT_VERSION,
        requestId,
        payload: {}
      }

      let response: unknown
      try {
        response = await dependencies.invoke(APP_GET_INFO_CHANNEL, request)
      } catch {
        return createLocalFailure('handler_threw', requestId)
      }

      const responseResult = appGetInfoResultSchema.safeParse(response)
      if (!responseResult.success) {
        return createLocalFailure('response_schema_invalid', requestId)
      }

      if (!responseResult.data.ok && responseResult.data.error.requestId !== requestId) {
        return createLocalFailure('response_schema_invalid', requestId)
      }

      return responseResult.data
    }
  }
}
