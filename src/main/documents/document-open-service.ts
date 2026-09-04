import { createDocumentSession, decodeSourceBuffer } from '../../domain/documents'
import type { DiskVersion } from '../../domain/documents'
import type { DocumentSnapshotReader } from './node-document-snapshot-reader'

export type DocumentOpenResult =
  | { readonly status: 'cancelled' }
  | { readonly status: 'failed'; readonly code: 'file-open-failed' }
  | {
      readonly status: 'opened'
      readonly accessMode: 'editable'
      readonly displayPath: string
      readonly authorizedPath: string
      readonly session: ReturnType<typeof createDocumentSession>
    }
  | {
      readonly status: 'opened'
      readonly accessMode: 'read-only'
      readonly reason: 'unsupported-encoding'
      readonly displayPath: string
      readonly authorizedPath: string
      readonly sessionId: string
      readonly originalBytes: Uint8Array
      readonly originalBytesHash: string
      readonly diskVersion: DiskVersion
    }

export interface DocumentOpenServiceDependencies {
  readonly selectFile: () => Promise<string | null>
  readonly readSnapshot: DocumentSnapshotReader
  readonly createSessionId: () => string
}

export interface DocumentOpenService {
  readonly openFromPicker: () => Promise<DocumentOpenResult>
}

export function createDocumentOpenService(
  dependencies: DocumentOpenServiceDependencies
): DocumentOpenService {
  return {
    openFromPicker: async () => {
      const displayPath = await dependencies.selectFile()
      if (displayPath === null) return { status: 'cancelled' }

      let snapshot: Awaited<ReturnType<DocumentSnapshotReader>>
      try {
        snapshot = await dependencies.readSnapshot(displayPath)
      } catch {
        return { status: 'failed', code: 'file-open-failed' }
      }
      const decoded = decodeSourceBuffer(snapshot.bytes, snapshot.diskVersion.contentHash)
      const sessionId = dependencies.createSessionId()
      if (decoded.status === 'read-only') {
        return {
          status: 'opened',
          accessMode: 'read-only',
          reason: decoded.reason,
          displayPath,
          authorizedPath: snapshot.authorizedPath,
          sessionId,
          originalBytes: decoded.originalBytes,
          originalBytesHash: decoded.originalBytesHash,
          diskVersion: snapshot.diskVersion
        }
      }

      return {
        status: 'opened',
        accessMode: 'editable',
        displayPath,
        authorizedPath: snapshot.authorizedPath,
        session: createDocumentSession({
          id: sessionId,
          path: snapshot.authorizedPath,
          buffer: decoded.buffer,
          diskVersion: snapshot.diskVersion
        })
      }
    }
  }
}
