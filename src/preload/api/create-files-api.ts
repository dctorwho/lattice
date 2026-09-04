import {
  FILES_OPEN_CHANNEL,
  FILES_RELOAD_EXTERNAL_CHANNEL,
  FILES_EXTERNAL_CHANGE_EVENT,
  FILES_CONFIRMED_OVERWRITE_CHANNEL,
  FILES_SAVE_AS_CHANNEL,
  FILES_SAVE_CHANNEL,
  filesConfirmedOverwriteResultSchema,
  filesOpenResultSchema,
  filesReloadExternalResultSchema,
  filesSaveAsResultSchema,
  filesSaveResultSchema,
  filesExternalChangeEventSchema,
  IPC_CONTRACT_VERSION,
  requestIdSchema,
  type ApprovedIpcChannel,
  type FilesOpenResult,
  type FilesReloadExternalResult,
  type FilesConfirmedOverwriteResult,
  type FilesSaveAsResult,
  type FilesSaveResult,
  type FilesExternalChangeEvent,
  type LatticeDesktopApi
} from '../../shared/contracts'
import type { IpcSafeReason } from '../../shared/errors'

export interface FilesApiDependencies {
  readonly createRequestId: () => string
  readonly invoke: (channel: ApprovedIpcChannel, request: unknown) => Promise<unknown>
  readonly on?: (channel: typeof FILES_EXTERNAL_CHANGE_EVENT, listener: FilesEventListener) => void
  readonly removeListener?: (
    channel: typeof FILES_EXTERNAL_CHANGE_EVENT,
    listener: FilesEventListener
  ) => void
}

type FilesEventListener = (event: unknown, payload: unknown) => void

function createLocalFailure(reason: IpcSafeReason, requestId?: string): FilesOpenResult {
  return filesOpenResultSchema.parse({
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

function createSaveLocalFailure(reason: IpcSafeReason, requestId?: string): FilesSaveResult {
  return filesSaveResultSchema.parse(createLocalFailure(reason, requestId))
}

function createSaveAsLocalFailure(reason: IpcSafeReason, requestId?: string): FilesSaveAsResult {
  return filesSaveAsResultSchema.parse(createLocalFailure(reason, requestId))
}

function createConfirmedOverwriteLocalFailure(
  reason: IpcSafeReason,
  requestId?: string
): FilesConfirmedOverwriteResult {
  return filesConfirmedOverwriteResultSchema.parse(createLocalFailure(reason, requestId))
}

function createReloadExternalLocalFailure(
  reason: IpcSafeReason,
  requestId?: string
): FilesReloadExternalResult {
  return filesReloadExternalResultSchema.parse(createLocalFailure(reason, requestId))
}

export function createFilesApi(dependencies: FilesApiDependencies): LatticeDesktopApi['files'] {
  async function invokeValidated<T>(
    channel: ApprovedIpcChannel,
    payload: unknown,
    responseSchema: { readonly safeParse: (value: unknown) => { success: boolean; data?: T } },
    createFailure: (reason: IpcSafeReason, requestId?: string) => T
  ): Promise<T> {
    let requestIdCandidate: string
    try {
      requestIdCandidate = dependencies.createRequestId()
    } catch {
      return createFailure('schema_invalid')
    }
    const parsedRequestId = requestIdSchema.safeParse(requestIdCandidate)
    if (!parsedRequestId.success) return createFailure('schema_invalid')
    const requestId = parsedRequestId.data

    let response: unknown
    try {
      response = await dependencies.invoke(channel, {
        contractVersion: IPC_CONTRACT_VERSION,
        requestId,
        payload
      })
    } catch {
      return createFailure('handler_threw', requestId)
    }
    const parsedResponse = responseSchema.safeParse(response)
    if (!parsedResponse.success || parsedResponse.data === undefined) {
      return createFailure('response_schema_invalid', requestId)
    }
    const result = parsedResponse.data
    if (
      typeof result === 'object' &&
      result !== null &&
      'ok' in result &&
      result.ok === false &&
      'error' in result &&
      typeof result.error === 'object' &&
      result.error !== null &&
      'requestId' in result.error &&
      result.error.requestId !== requestId
    ) {
      return createFailure('response_schema_invalid', requestId)
    }
    return result
  }

  return {
    open: () => invokeValidated(FILES_OPEN_CHANNEL, {}, filesOpenResultSchema, createLocalFailure),
    save: (request) =>
      invokeValidated(FILES_SAVE_CHANNEL, request, filesSaveResultSchema, createSaveLocalFailure),
    saveAs: (request) =>
      invokeValidated(
        FILES_SAVE_AS_CHANNEL,
        request,
        filesSaveAsResultSchema,
        createSaveAsLocalFailure
      ),
    confirmedOverwrite: (request) =>
      invokeValidated(
        FILES_CONFIRMED_OVERWRITE_CHANNEL,
        request,
        filesConfirmedOverwriteResultSchema,
        createConfirmedOverwriteLocalFailure
      ),
    reloadExternal: (request) =>
      invokeValidated(
        FILES_RELOAD_EXTERNAL_CHANNEL,
        request,
        filesReloadExternalResultSchema,
        createReloadExternalLocalFailure
      ),
    onExternalChange: (listener: (event: FilesExternalChangeEvent) => void): (() => void) => {
      if (dependencies.on === undefined || dependencies.removeListener === undefined)
        return () => {}
      const wrapped: FilesEventListener = (_event, payload) => {
        const parsed = filesExternalChangeEventSchema.safeParse(payload)
        if (!parsed.success) return
        listener(parsed.data)
      }
      dependencies.on(FILES_EXTERNAL_CHANGE_EVENT, wrapped)
      let subscribed = true
      return () => {
        if (!subscribed) return
        subscribed = false
        dependencies.removeListener?.(FILES_EXTERNAL_CHANGE_EVENT, wrapped)
      }
    }
  }
}
