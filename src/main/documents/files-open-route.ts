import {
  createUntitledDocumentSession,
  decodeSourceBuffer,
  reloadDocumentFromDisk,
  type DiskVersion,
  type DocumentSession
} from '../../domain/documents'
import {
  FILES_OPEN_CHANNEL,
  FILES_CONFIRMED_OVERWRITE_CHANNEL,
  FILES_RELOAD_EXTERNAL_CHANNEL,
  FILES_SAVE_AS_CHANNEL,
  FILES_SAVE_CHANNEL,
  filesOpenRequestSchema,
  filesOpenResultSchema,
  filesReloadExternalRequestSchema,
  filesReloadExternalResultSchema,
  filesConfirmedOverwriteRequestSchema,
  filesConfirmedOverwriteResultSchema,
  filesSaveAsRequestSchema,
  filesSaveAsResultSchema,
  filesSaveRequestSchema,
  filesSaveResultSchema,
  type FilesOpenRequest,
  type FilesConfirmedOverwriteRequest,
  type FilesSaveAsRequest,
  type FilesSaveRequest,
  type FileSaveOutcome,
  type FilesReloadExternalRequest,
  type ReloadedExternalFile,
  type OpenedFile
} from '../../shared/contracts'
import type { IpcRoute } from '../ipc/create-ipc-router'
import type { ValidatedIpcContext } from '../ipc/validate-ipc-sender'
import { createAppError } from '../../shared/errors'
import type { DocumentOpenResult } from './document-open-service'
import type { DocumentFileSnapshot, DocumentSnapshotReader } from './node-document-snapshot-reader'

export interface FilesOpenRouteDependencies {
  readonly openFromPicker: (context: ValidatedIpcContext) => Promise<DocumentOpenResult>
  readonly rememberSession: (windowId: number, session: DocumentSession) => void
}

export interface FilesReloadExternalRouteDependencies {
  readonly findSession: (windowId: number, documentId: string) => DocumentSession | undefined
  readonly readSnapshot: DocumentSnapshotReader
  readonly rememberSession: (windowId: number, session: DocumentSession) => void
}

export function createFilesReloadExternalRoute(
  dependencies: FilesReloadExternalRouteDependencies
): IpcRoute<FilesReloadExternalRequest, ReloadedExternalFile> {
  return {
    channel: FILES_RELOAD_EXTERNAL_CHANNEL,
    requestSchema: filesReloadExternalRequestSchema,
    responseSchema: filesReloadExternalResultSchema,
    responseValueLimits: {
      maxCharacters: 12 * 1024 * 1024,
      maxDepth: 8,
      maxEntries: 10 * 1024 * 1024
    },
    handle: async (request, context) => {
      const session = dependencies.findSession(context.windowId, request.payload.documentId)
      if (session === undefined || session.path !== request.payload.path) {
        return { ok: false, error: createAppError('IPC_INVALID_REQUEST', request.requestId) }
      }
      const external = await dependencies.readSnapshot(session.path)
      if (
        external.authorizedPath !== session.path ||
        !sameDiskVersion(external.diskVersion, request.payload.expectedDiskVersion)
      ) {
        return { ok: false, error: createAppError('FILE_CHANGED_EXTERNALLY', request.requestId) }
      }
      const decoded = decodeSourceBuffer(external.bytes, external.diskVersion.contentHash)
      if (decoded.status !== 'editable') {
        return { ok: false, error: createAppError('FILE_CHANGED_EXTERNALLY', request.requestId) }
      }
      const reloaded = reloadDocumentFromDisk(session, {
        buffer: decoded.buffer,
        diskVersion: external.diskVersion
      })
      dependencies.rememberSession(context.windowId, reloaded)
      return {
        ok: true,
        value: {
          documentId: reloaded.id,
          path: reloaded.path ?? external.authorizedPath,
          revision: reloaded.revision,
          text: reloaded.buffer.text,
          encoding: reloaded.buffer.encoding,
          eolByLine: [...reloaded.buffer.eolByLine],
          bytesHash: reloaded.buffer.originalBytesHash,
          diskVersion: external.diskVersion,
          accessMode: 'editable'
        }
      }
    }
  }
}

function sameDiskVersion(left: DiskVersion, right: DiskVersion): boolean {
  return (
    left.mtimeMs === right.mtimeMs &&
    left.size === right.size &&
    left.contentHash === right.contentHash
  )
}

export function createFilesOpenRoute(
  dependencies: FilesOpenRouteDependencies
): IpcRoute<FilesOpenRequest, OpenedFile | null> {
  return {
    channel: FILES_OPEN_CHANNEL,
    requestSchema: filesOpenRequestSchema,
    responseSchema: filesOpenResultSchema,
    responseValueLimits: {
      maxCharacters: 12 * 1024 * 1024,
      maxDepth: 8,
      maxEntries: 10 * 1024 * 1024
    },
    handle: async (_request, context) => {
      const result = await dependencies.openFromPicker(context)
      if (result.status === 'cancelled') return { ok: true, value: null }
      if (result.status === 'failed') throw new Error('Authorized document open failed')
      if (result.accessMode === 'read-only') {
        return {
          ok: true,
          value: {
            accessMode: 'read-only',
            reason: result.reason,
            documentId: result.sessionId,
            path: result.authorizedPath,
            bytesHash: result.originalBytesHash,
            diskVersion: result.diskVersion
          }
        }
      }

      const diskVersion = result.session.diskVersion
      if (diskVersion === null) {
        throw new Error('Opened disk document is missing its disk version')
      }
      dependencies.rememberSession(context.windowId, result.session)
      return {
        ok: true,
        value: {
          accessMode: 'editable',
          documentId: result.session.id,
          path: result.authorizedPath,
          text: result.session.buffer.text,
          encoding: result.session.buffer.encoding,
          eolByLine: [...result.session.buffer.eolByLine],
          bytesHash: result.session.buffer.originalBytesHash,
          diskVersion
        }
      }
    }
  }
}

type SaveSessionResult =
  | { readonly status: 'saved'; readonly session: DocumentSession }
  | {
      readonly status: 'conflict'
      readonly session: DocumentSession
      readonly diskVersion: DiskVersion | null
    }
  | {
      readonly status: 'failed'
      readonly code: 'FILE_ATOMIC_SAVE_FAILED'
      readonly session: DocumentSession
    }

export interface FileConflictRecord {
  readonly token: string
  readonly windowId: number
  readonly documentId: string
  readonly localSession: DocumentSession
  readonly external: DocumentFileSnapshot
}

interface ConflictCaptureDependencies {
  readonly readSnapshot: DocumentSnapshotReader
  readonly createConflictToken: () => string
  readonly rememberConflict: (record: FileConflictRecord) => void
}

export interface FilesSaveRouteDependencies {
  readonly findSession: (windowId: number, documentId: string) => DocumentSession | undefined
  readonly saveSession: (session: DocumentSession) => Promise<SaveSessionResult>
  readonly rememberSession: (windowId: number, session: DocumentSession) => void
  readonly readSnapshot?: DocumentSnapshotReader
  readonly createConflictToken?: () => string
  readonly rememberConflict?: (record: FileConflictRecord) => void
}

export function createFilesSaveRoute(
  dependencies: FilesSaveRouteDependencies
): IpcRoute<FilesSaveRequest, import('../../shared/contracts').FileSaveOutcome> {
  return {
    channel: FILES_SAVE_CHANNEL,
    requestSchema: filesSaveRequestSchema,
    responseSchema: filesSaveResultSchema,
    responseValueLimits: {
      maxCharacters: 12 * 1024 * 1024,
      maxDepth: 8,
      maxEntries: 10 * 1024 * 1024
    },
    handle: async (request, context) => {
      const session = dependencies.findSession(context.windowId, request.payload.documentId)
      if (session === undefined) throw new Error('Document session is not authorized for window')
      let candidate: DocumentSession
      try {
        candidate = synchronizeSaveSnapshot(session, request)
      } catch {
        return {
          ok: false,
          error: createAppError('DOCUMENT_STALE_PATCH', request.requestId)
        }
      }
      const result = await dependencies.saveSession(candidate)
      if (result.status === 'conflict') {
        if (result.diskVersion === null) {
          return {
            ok: false,
            error: createAppError('FILE_DELETED_EXTERNALLY', request.requestId)
          }
        }
        const readSnapshot = dependencies.readSnapshot
        const createConflictToken = dependencies.createConflictToken
        const rememberConflict = dependencies.rememberConflict
        if (
          candidate.path === null ||
          readSnapshot === undefined ||
          createConflictToken === undefined ||
          rememberConflict === undefined
        ) {
          throw new Error('Document conflict dependencies are unavailable')
        }
        return {
          ok: true,
          value: await captureConflictOutcome(candidate, context.windowId, result.diskVersion, {
            readSnapshot,
            createConflictToken,
            rememberConflict
          })
        }
      }
      if (result.status === 'failed') {
        return {
          ok: false,
          error: createAppError(result.code, request.requestId)
        }
      }
      dependencies.rememberSession(context.windowId, result.session)
      const diskVersion = result.session.diskVersion
      if (result.session.path === null || diskVersion === null) {
        throw new Error('Saved document identity is incomplete')
      }
      return {
        ok: true,
        value: {
          status: 'saved',
          file: {
            path: result.session.path,
            revision: result.session.revision,
            diskVersion,
            bytesHash: diskVersion.contentHash
          }
        }
      }
    }
  }
}

export interface FilesSaveAsRouteDependencies {
  readonly findSession: (windowId: number, documentId: string) => DocumentSession | undefined
  readonly chooseSavePath: (context: ValidatedIpcContext) => Promise<string | null>
  readonly inspectTarget: (path: string) => Promise<DocumentFileSnapshot | null>
  readonly saveAsSession: (
    session: DocumentSession,
    path: string,
    expectedDiskVersion: DiskVersion | null
  ) => Promise<SaveSessionResult>
  readonly rememberSession: (windowId: number, session: DocumentSession) => void
  readonly readSnapshot: DocumentSnapshotReader
  readonly createConflictToken: () => string
  readonly rememberConflict: (record: FileConflictRecord) => void
}

export function createFilesSaveAsRoute(
  dependencies: FilesSaveAsRouteDependencies
): IpcRoute<FilesSaveAsRequest, import('../../shared/contracts').FileSaveOutcome | null> {
  return {
    channel: FILES_SAVE_AS_CHANNEL,
    requestSchema: filesSaveAsRequestSchema,
    responseSchema: filesSaveAsResultSchema,
    responseValueLimits: {
      maxCharacters: 12 * 1024 * 1024,
      maxDepth: 8,
      maxEntries: 10 * 1024 * 1024
    },
    handle: async (request, context) => {
      const session =
        dependencies.findSession(context.windowId, request.payload.documentId) ??
        createUntitledDocumentSession(request.payload.documentId)
      let candidate: DocumentSession
      try {
        candidate = synchronizeDocumentContentSnapshot(session, request.payload)
      } catch {
        return {
          ok: false,
          error: createAppError('DOCUMENT_STALE_PATCH', request.requestId)
        }
      }
      const targetPath = await dependencies.chooseSavePath(context)
      if (targetPath === null) return { ok: true, value: null }
      const target = await dependencies.inspectTarget(targetPath)
      const result = await dependencies.saveAsSession(
        candidate,
        targetPath,
        target?.diskVersion ?? null
      )
      if (result.status === 'failed') {
        return {
          ok: false,
          error: createAppError(result.code, request.requestId)
        }
      }
      if (result.status === 'conflict') {
        if (result.diskVersion === null) {
          return { ok: false, error: createAppError('FILE_CHANGED_EXTERNALLY', request.requestId) }
        }
        return {
          ok: true,
          value: await captureConflictOutcome(
            candidate,
            context.windowId,
            result.diskVersion,
            {
              readSnapshot: dependencies.readSnapshot,
              createConflictToken: dependencies.createConflictToken,
              rememberConflict: dependencies.rememberConflict
            },
            targetPath
          )
        }
      }
      dependencies.rememberSession(context.windowId, result.session)
      return { ok: true, value: savedOutcome(result.session) }
    }
  }
}

export interface FilesConfirmedOverwriteRouteDependencies {
  readonly takeConflict: (token: string) => FileConflictRecord | undefined
  readonly saveAsSession: (
    session: DocumentSession,
    path: string,
    expectedDiskVersion: DiskVersion
  ) => Promise<SaveSessionResult>
  readonly rememberSession: (windowId: number, session: DocumentSession) => void
  readonly readSnapshot: DocumentSnapshotReader
  readonly createConflictToken: () => string
  readonly rememberConflict: (record: FileConflictRecord) => void
}

export function createFilesConfirmedOverwriteRoute(
  dependencies: FilesConfirmedOverwriteRouteDependencies
): IpcRoute<FilesConfirmedOverwriteRequest, import('../../shared/contracts').FileSaveOutcome> {
  return {
    channel: FILES_CONFIRMED_OVERWRITE_CHANNEL,
    requestSchema: filesConfirmedOverwriteRequestSchema,
    responseSchema: filesConfirmedOverwriteResultSchema,
    responseValueLimits: {
      maxCharacters: 12 * 1024 * 1024,
      maxDepth: 8,
      maxEntries: 10 * 1024 * 1024
    },
    handle: async (request, context) => {
      const conflict = dependencies.takeConflict(request.payload.conflictToken)
      if (
        conflict === undefined ||
        conflict.windowId !== context.windowId ||
        conflict.documentId !== request.payload.documentId
      ) {
        return { ok: false, error: createAppError('IPC_INVALID_REQUEST', request.requestId) }
      }
      let candidate: DocumentSession
      try {
        candidate = synchronizeDocumentContentSnapshot(conflict.localSession, request.payload)
      } catch {
        return {
          ok: false,
          error: createAppError('DOCUMENT_STALE_PATCH', request.requestId)
        }
      }
      const result = await dependencies.saveAsSession(
        candidate,
        conflict.external.authorizedPath,
        conflict.external.diskVersion
      )
      if (result.status === 'failed') {
        return { ok: false, error: createAppError(result.code, request.requestId) }
      }
      if (result.status === 'conflict') {
        if (result.diskVersion === null) {
          return { ok: false, error: createAppError('FILE_DELETED_EXTERNALLY', request.requestId) }
        }
        return {
          ok: true,
          value: await captureConflictOutcome(
            candidate,
            context.windowId,
            result.diskVersion,
            {
              readSnapshot: dependencies.readSnapshot,
              createConflictToken: dependencies.createConflictToken,
              rememberConflict: dependencies.rememberConflict
            },
            conflict.external.authorizedPath
          )
        }
      }
      dependencies.rememberSession(context.windowId, result.session)
      return { ok: true, value: savedOutcome(result.session) }
    }
  }
}

function synchronizeSaveSnapshot(
  session: DocumentSession,
  request: FilesSaveRequest
): DocumentSession {
  const snapshot = request.payload
  if (
    session.path === null ||
    session.diskVersion === null ||
    snapshot.path !== session.path ||
    snapshot.encoding !== session.buffer.encoding ||
    snapshot.expectedDiskVersion.mtimeMs !== session.diskVersion.mtimeMs ||
    snapshot.expectedDiskVersion.size !== session.diskVersion.size ||
    snapshot.expectedDiskVersion.contentHash !== session.diskVersion.contentHash ||
    snapshot.revision < session.revision
  ) {
    throw new Error('Document save snapshot is stale or does not match its authorization')
  }

  return synchronizeDocumentContentSnapshot(session, snapshot)
}

function synchronizeDocumentContentSnapshot(
  session: DocumentSession,
  snapshot: {
    readonly documentId: string
    readonly revision: number
    readonly text: string
    readonly encoding: DocumentSession['buffer']['encoding']
    readonly eolByLine: readonly DocumentSession['buffer']['eolByLine'][number][]
  }
): DocumentSession {
  if (
    snapshot.documentId !== session.id ||
    snapshot.encoding !== session.buffer.encoding ||
    snapshot.revision < session.revision
  ) {
    throw new Error('Document content snapshot is stale')
  }
  const contentChanged =
    snapshot.text !== session.buffer.text ||
    snapshot.eolByLine.length !== session.buffer.eolByLine.length ||
    snapshot.eolByLine.some((eol, index) => eol !== session.buffer.eolByLine[index])
  if (contentChanged && snapshot.revision === session.revision) {
    throw new Error('Changed document save snapshot must advance its revision')
  }

  return {
    ...session,
    buffer: {
      ...session.buffer,
      text: snapshot.text,
      eolByLine: [...snapshot.eolByLine]
    },
    revision: snapshot.revision,
    currentContentRevision: contentChanged ? snapshot.revision : session.currentContentRevision
  }
}

function savedOutcome(
  session: DocumentSession
): Extract<import('../../shared/contracts').FileSaveOutcome, { readonly status: 'saved' }> {
  if (session.path === null || session.diskVersion === null) {
    throw new Error('Saved document identity is incomplete')
  }
  return {
    status: 'saved',
    file: {
      path: session.path,
      revision: session.revision,
      diskVersion: session.diskVersion,
      bytesHash: session.diskVersion.contentHash
    }
  }
}

async function captureConflictOutcome(
  localSession: DocumentSession,
  windowId: number,
  expectedVersion: DiskVersion,
  dependencies: ConflictCaptureDependencies,
  explicitPath?: string
): Promise<Extract<FileSaveOutcome, { readonly status: 'conflict' }>> {
  const path = explicitPath ?? localSession.path
  if (path === null) throw new Error('Conflict path is unavailable')
  const external = await dependencies.readSnapshot(path)
  if (
    external.diskVersion.mtimeMs !== expectedVersion.mtimeMs ||
    external.diskVersion.size !== expectedVersion.size ||
    external.diskVersion.contentHash !== expectedVersion.contentHash
  ) {
    throw new Error('External document changed while conflict evidence was captured')
  }
  const token = dependencies.createConflictToken()
  dependencies.rememberConflict({
    token,
    windowId,
    documentId: localSession.id,
    localSession,
    external
  })
  const decoded = decodeSourceBuffer(external.bytes, external.diskVersion.contentHash)
  return {
    status: 'conflict',
    conflictToken: token,
    external:
      decoded.status === 'editable'
        ? {
            accessMode: 'editable',
            text: decoded.buffer.text,
            encoding: decoded.buffer.encoding,
            eolByLine: [...decoded.buffer.eolByLine],
            bytesHash: decoded.buffer.originalBytesHash,
            diskVersion: external.diskVersion
          }
        : {
            accessMode: 'read-only',
            reason: decoded.reason,
            bytesHash: decoded.originalBytesHash,
            diskVersion: external.diskVersion
          }
  }
}
