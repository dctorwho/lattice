import {
  encodeSourceBuffer,
  markDocumentSaved,
  rebaseSourceBuffer,
  type DiskVersion,
  type DocumentSession
} from '../../domain/documents'

export interface AtomicFileSaveRequest {
  readonly path: string
  readonly bytes: Uint8Array
  readonly expectedDiskVersion: DiskVersion | null
}

export interface AtomicFileSaveSuccess {
  readonly status: 'saved'
  readonly diskVersion: DiskVersion
}

export interface AtomicFileSaveConflict {
  readonly status: 'conflict'
  readonly diskVersion: DiskVersion | null
}

export type AtomicFileSaveResult = AtomicFileSaveSuccess | AtomicFileSaveConflict

export type AtomicFileSaver = (request: AtomicFileSaveRequest) => Promise<AtomicFileSaveResult>

export interface AtomicDocumentSaveServiceDependencies {
  readonly saveFile: AtomicFileSaver
}

export interface AtomicDocumentSaveService {
  readonly save: (session: DocumentSession) => Promise<
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
  >
  readonly saveAs: (
    session: DocumentSession,
    path: string,
    expectedDiskVersion: DiskVersion | null
  ) => ReturnType<AtomicDocumentSaveService['save']>
}

export function createAtomicDocumentSaveService(
  dependencies: AtomicDocumentSaveServiceDependencies
): AtomicDocumentSaveService {
  async function saveTo(
    session: DocumentSession,
    path: string,
    expectedDiskVersion: DiskVersion | null
  ): ReturnType<AtomicDocumentSaveService['save']> {
    const bytes = encodeSourceBuffer(session.buffer)
    let saved: AtomicFileSaveResult
    try {
      saved = await dependencies.saveFile({ path, bytes, expectedDiskVersion })
    } catch {
      return {
        status: 'failed',
        code: 'FILE_ATOMIC_SAVE_FAILED',
        session
      }
    }
    if (saved.status === 'conflict') {
      return {
        status: 'conflict',
        session,
        diskVersion: saved.diskVersion
      }
    }

    const buffer = rebaseSourceBuffer(session.buffer, bytes, saved.diskVersion.contentHash)
    return {
      status: 'saved',
      session: markDocumentSaved({ ...session, path, buffer }, { diskVersion: saved.diskVersion })
    }
  }

  return {
    save: async (session) => {
      if (session.path === null || session.diskVersion === null) {
        throw new Error('Atomic save requires an existing authorized path')
      }
      return saveTo(session, session.path, session.diskVersion)
    },
    saveAs: saveTo
  }
}
