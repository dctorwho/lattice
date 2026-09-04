import { watch, type FSWatcher } from 'chokidar'

import { decodeSourceBuffer, type DocumentSession } from '../../domain/documents'
import type { FilesExternalChangeEvent } from '../../shared/contracts'
import type { DocumentSnapshotReader } from './node-document-snapshot-reader'

interface ActiveWatcher {
  readonly path: string
  readonly watcher: FSWatcher
  lastEmittedKey: string | null
}

export interface NodeFileWatcherDependencies {
  readonly readSnapshot: DocumentSnapshotReader
  readonly findSession: (windowId: number, documentId: string) => DocumentSession | undefined
  readonly emit: (windowId: number, event: FilesExternalChangeEvent) => void
}

export interface NodeFileWatcherManager {
  readonly watchDocument: (windowId: number, session: DocumentSession) => void
  readonly closeWindow: (windowId: number) => Promise<void>
}

export function createNodeFileWatcherManager(
  dependencies: NodeFileWatcherDependencies
): NodeFileWatcherManager {
  const watchers = new Map<string, ActiveWatcher>()

  function keyFor(windowId: number, documentId: string): string {
    return `${windowId}:${documentId}`
  }

  function watchDocument(windowId: number, session: DocumentSession): void {
    if (session.path === null) return
    const key = keyFor(windowId, session.id)
    const current = watchers.get(key)
    if (current?.path === session.path) return
    if (current !== undefined) void current.watcher.close()

    const path = session.path
    const watcher = watch(path, {
      persistent: false,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 25 }
    })
    const active: ActiveWatcher = { path, watcher, lastEmittedKey: null }
    watchers.set(key, active)

    watcher.on('change', () => void emitChanged(windowId, session.id, active, dependencies))
    watcher.on('unlink', () => {
      if (active.lastEmittedKey === 'deleted') return
      active.lastEmittedKey = 'deleted'
      dependencies.emit(windowId, {
        contractVersion: 1,
        kind: 'deleted',
        documentId: session.id,
        path
      })
    })
  }

  return {
    watchDocument,
    closeWindow: async (windowId) => {
      const closing: Promise<void>[] = []
      for (const [key, active] of watchers) {
        if (!key.startsWith(`${windowId}:`)) continue
        watchers.delete(key)
        closing.push(active.watcher.close())
      }
      await Promise.all(closing)
    }
  }
}

async function emitChanged(
  windowId: number,
  documentId: string,
  active: ActiveWatcher,
  dependencies: NodeFileWatcherDependencies
): Promise<void> {
  try {
    const snapshot = await dependencies.readSnapshot(active.path)
    const session = dependencies.findSession(windowId, documentId)
    if (session?.diskVersion?.contentHash === snapshot.diskVersion.contentHash) return
    const eventKey = `changed:${snapshot.diskVersion.contentHash}`
    if (active.lastEmittedKey === eventKey) return
    active.lastEmittedKey = eventKey
    const decoded = decodeSourceBuffer(snapshot.bytes, snapshot.diskVersion.contentHash)
    dependencies.emit(windowId, {
      contractVersion: 1,
      kind: 'changed',
      documentId,
      path: active.path,
      external:
        decoded.status === 'editable'
          ? {
              accessMode: 'editable',
              text: decoded.buffer.text,
              encoding: decoded.buffer.encoding,
              eolByLine: [...decoded.buffer.eolByLine],
              bytesHash: snapshot.diskVersion.contentHash,
              diskVersion: snapshot.diskVersion
            }
          : {
              accessMode: 'read-only',
              reason: 'unsupported-encoding',
              bytesHash: snapshot.diskVersion.contentHash,
              diskVersion: snapshot.diskVersion
            }
    })
  } catch {
    return
  }
}
