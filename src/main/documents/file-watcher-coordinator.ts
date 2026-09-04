import {
  decodeSourceBuffer,
  isDocumentSessionDirty,
  reloadDocumentFromDisk,
  setDocumentExternalState,
  type DocumentSession
} from '../../domain/documents'
import type { DocumentFileSnapshot, DocumentSnapshotReader } from './node-document-snapshot-reader'

export interface FileWatcherEvent {
  readonly kind: 'change' | 'delete'
  readonly sequence: number
}

type FileWatcherResult =
  | {
      readonly status: 'ignored' | 'reloaded' | 'deleted' | 'unavailable'
      readonly session: DocumentSession
      readonly autosavePaused: boolean
    }
  | {
      readonly status: 'conflict'
      readonly session: DocumentSession
      readonly autosavePaused: true
      readonly external: DocumentFileSnapshot
    }

export interface FileWatcherCoordinatorDependencies {
  readonly readSnapshot: DocumentSnapshotReader
}

export interface FileWatcherCoordinator {
  readonly handle: (session: DocumentSession, event: FileWatcherEvent) => Promise<FileWatcherResult>
}

export function createFileWatcherCoordinator(
  dependencies: FileWatcherCoordinatorDependencies
): FileWatcherCoordinator {
  const latestSequenceBySession = new Map<string, number>()

  return {
    handle: async (session, event) => {
      const latestSequence = latestSequenceBySession.get(session.id) ?? -1
      if (!Number.isSafeInteger(event.sequence) || event.sequence <= latestSequence) {
        return unchanged('ignored', session)
      }
      latestSequenceBySession.set(session.id, event.sequence)

      if (event.kind === 'delete') {
        const deleted = setDocumentExternalState(session, 'deleted')
        return {
          status: 'deleted',
          session: deleted,
          autosavePaused: isDocumentSessionDirty(deleted)
        }
      }
      if (session.path === null) return unchanged('ignored', session)

      let external: DocumentFileSnapshot
      try {
        external = await dependencies.readSnapshot(session.path)
      } catch {
        const unavailable = setDocumentExternalState(session, 'unknown')
        return {
          status: 'unavailable',
          session: unavailable,
          autosavePaused: isDocumentSessionDirty(unavailable)
        }
      }

      if (external.diskVersion.contentHash === session.diskVersion?.contentHash) {
        return unchanged('ignored', session)
      }
      if (isDocumentSessionDirty(session)) {
        return {
          status: 'conflict',
          session: setDocumentExternalState(session, 'changed'),
          autosavePaused: true,
          external
        }
      }

      const decoded = decodeSourceBuffer(external.bytes, external.diskVersion.contentHash)
      if (decoded.status !== 'editable') {
        return {
          status: 'conflict',
          session: setDocumentExternalState(session, 'changed'),
          autosavePaused: true,
          external
        }
      }
      return {
        status: 'reloaded',
        session: reloadDocumentFromDisk(session, {
          buffer: decoded.buffer,
          diskVersion: external.diskVersion
        }),
        autosavePaused: false
      }
    }
  }
}

function unchanged(status: 'ignored', session: DocumentSession): FileWatcherResult {
  return { status, session, autosavePaused: false }
}
