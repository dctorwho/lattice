import {
  createSourceBufferFromText,
  restoreDocumentSession,
  type DocumentSession
} from '../../domain/documents'
import {
  RECOVERY_DISCARD_CHANNEL,
  RECOVERY_LIST_CHANNEL,
  RECOVERY_WRITE_CHANNEL,
  recoveryDiscardRequestSchema,
  recoveryDiscardResultSchema,
  recoveryListRequestSchema,
  recoveryListResultSchema,
  recoveryWriteRequestSchema,
  recoveryWriteResultSchema,
  type RecoveryRecord,
  type RecoverySnapshot
} from '../../shared/contracts'
import { createAppError } from '../../shared/errors'
import type { IpcRoute } from '../ipc/create-ipc-router'
import type {
  NodeRecoveryStore,
  RecoveryRecord as StoredRecoveryRecord
} from './node-recovery-store'

const LARGE_DOCUMENT_LIMITS = {
  maxCharacters: 12 * 1024 * 1024,
  maxDepth: 10,
  maxEntries: 10 * 1024 * 1024
} as const

export interface RecoveryRouteDependencies {
  readonly store: NodeRecoveryStore
  readonly findSession: (windowId: number, documentId: string) => DocumentSession | undefined
  readonly rememberSession: (windowId: number, session: DocumentSession) => void
}

export function createRecoveryRoutes(
  dependencies: RecoveryRouteDependencies
): readonly IpcRoute<unknown, unknown>[] {
  const write: IpcRoute<unknown, unknown> = {
    channel: RECOVERY_WRITE_CHANNEL,
    requestSchema: recoveryWriteRequestSchema,
    responseSchema: recoveryWriteResultSchema,
    requestValueLimits: LARGE_DOCUMENT_LIMITS,
    handle: async (request, context) => {
      const parsedRequest = recoveryWriteRequestSchema.parse(request)
      const snapshot = parsedRequest.payload
      const session = authorizeRecoverySnapshot(
        dependencies.findSession(context.windowId, snapshot.documentId),
        snapshot
      )
      if (session === null) {
        return {
          ok: false,
          error: createAppError('IPC_INVALID_REQUEST', parsedRequest.requestId)
        }
      }
      dependencies.rememberSession(context.windowId, session)
      try {
        await dependencies.store.write(session)
        return { ok: true, value: { applied: true } }
      } catch {
        return {
          ok: false,
          error: createAppError('RECOVERY_WRITE_FAILED', parsedRequest.requestId, {
            reason: 'handler_threw'
          })
        }
      }
    }
  }
  const list: IpcRoute<unknown, unknown> = {
    channel: RECOVERY_LIST_CHANNEL,
    requestSchema: recoveryListRequestSchema,
    responseSchema: recoveryListResultSchema,
    responseValueLimits: LARGE_DOCUMENT_LIMITS,
    handle: async (_request, context) => {
      const records = await dependencies.store.list()
      for (const record of records) {
        dependencies.rememberSession(context.windowId, sessionFromRecord(record))
      }
      return { ok: true, value: records.map(toContractRecord) }
    }
  }
  const discard: IpcRoute<unknown, unknown> = {
    channel: RECOVERY_DISCARD_CHANNEL,
    requestSchema: recoveryDiscardRequestSchema,
    responseSchema: recoveryDiscardResultSchema,
    handle: async (request) => {
      const { documentId } = recoveryDiscardRequestSchema.parse(request).payload
      await dependencies.store.discard(documentId)
      return { ok: true, value: { applied: true } }
    }
  }
  return [write, list, discard]
}

function authorizeRecoverySnapshot(
  authorized: DocumentSession | undefined,
  snapshot: RecoverySnapshot
): DocumentSession | null {
  if (authorized === undefined) {
    if (snapshot.path !== null || snapshot.diskVersion !== null || snapshot.savedRevision !== 0) {
      return null
    }
    return sessionFromSnapshot(snapshot)
  }

  if (
    snapshot.documentId !== authorized.id ||
    snapshot.path !== authorized.path ||
    snapshot.encoding !== authorized.buffer.encoding ||
    snapshot.originalBytesHash !== authorized.buffer.originalBytesHash ||
    snapshot.savedRevision !== authorized.savedRevision ||
    snapshot.revision < authorized.revision ||
    !sameDiskVersion(snapshot.diskVersion, authorized.diskVersion)
  ) {
    return null
  }

  const contentChanged =
    snapshot.text !== authorized.buffer.text ||
    snapshot.eolByLine.length !== authorized.buffer.eolByLine.length ||
    snapshot.eolByLine.some((eol, index) => eol !== authorized.buffer.eolByLine[index])
  if (contentChanged && snapshot.revision === authorized.revision) return null

  return {
    ...authorized,
    buffer: {
      ...authorized.buffer,
      text: snapshot.text,
      eolByLine: [...snapshot.eolByLine]
    },
    revision: snapshot.revision,
    currentContentRevision: snapshot.currentContentRevision
  }
}

function sessionFromSnapshot(snapshot: RecoverySnapshot): DocumentSession {
  return restoreDocumentSession({
    id: snapshot.documentId,
    path: snapshot.path,
    buffer: createSourceBufferFromText({
      text: snapshot.text,
      encoding: snapshot.encoding,
      eolByLine: snapshot.eolByLine,
      originalBytesHash: snapshot.originalBytesHash
    }),
    diskVersion: snapshot.diskVersion,
    revision: snapshot.revision,
    currentContentRevision: snapshot.currentContentRevision,
    savedRevision: snapshot.savedRevision
  })
}

function sessionFromRecord(record: StoredRecoveryRecord): DocumentSession {
  return restoreDocumentSession({
    id: record.sessionId,
    path: record.path,
    buffer: record.buffer,
    diskVersion: record.diskVersion,
    revision: record.revision,
    currentContentRevision: record.currentContentRevision,
    savedRevision: record.savedRevision
  })
}

function sameDiskVersion(
  left: DocumentSession['diskVersion'],
  right: DocumentSession['diskVersion']
): boolean {
  if (left === null || right === null) return left === right
  return (
    left.mtimeMs === right.mtimeMs &&
    left.size === right.size &&
    left.contentHash === right.contentHash
  )
}

function toContractRecord(record: StoredRecoveryRecord): RecoveryRecord {
  return {
    documentId: record.sessionId,
    path: record.path,
    revision: record.revision,
    currentContentRevision: record.currentContentRevision,
    savedRevision: record.savedRevision,
    text: record.buffer.text,
    encoding: record.buffer.encoding,
    eolByLine: [...record.buffer.eolByLine],
    originalBytesHash: record.buffer.originalBytesHash,
    diskVersion: record.diskVersion,
    createdAtMs: record.createdAtMs
  }
}
