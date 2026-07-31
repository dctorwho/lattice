import {
  APP_GET_INFO_CHANNEL,
  appGetInfoResultSchema,
  IPC_CONTRACT_VERSION,
  requestIdSchema,
  type ApprovedIpcChannel,
  type AppGetInfoResult,
  type LatticeDesktopApi
} from '../../shared/contracts'
import type { IpcSafeReason } from '../../shared/errors'

export interface AppApiDependencies {
  readonly createRequestId: () => string
  readonly invoke: (channel: ApprovedIpcChannel, request: unknown) => Promise<unknown>
}

function createLocalFailure(
  reason: IpcSafeReason,
  requestId?: string
): AppGetInfoResult {
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

export function createAppApi(
  dependencies: AppApiDependencies
): LatticeDesktopApi['app'] {
  return {
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

      return responseResult.data
    }
  }
}
