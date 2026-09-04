import { createHash } from 'node:crypto'
import { open, rename, rm, type FileHandle } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import type { DiskVersion } from '../../domain/documents'
import type { DocumentFileSnapshot } from './node-document-snapshot-reader'
import type { AtomicFileSaver } from './atomic-document-save-service'
import { createNodeDocumentSnapshotReader } from './node-document-snapshot-reader'

export type AtomicSaveStage =
  | 'after-temp-create'
  | 'after-write'
  | 'after-sync'
  | 'before-replace'
  | 'after-replace'
  | 'after-verify'

export interface NodeAtomicFileSaverOptions {
  readonly createTemporaryId: () => string
  readonly onStage?: (stage: AtomicSaveStage) => void | Promise<void>
  readonly replaceFile?: (temporaryPath: string, targetPath: string) => Promise<void>
  readonly wait?: (milliseconds: number) => Promise<void>
  readonly syncParentDirectory?: (directory: string) => Promise<void>
}

const REPLACE_RETRY_DELAYS_MS = [10, 30] as const

function sameDiskVersion(left: DiskVersion | null, right: DiskVersion | null): boolean {
  if (left === null || right === null) return left === right
  return (
    left.mtimeMs === right.mtimeMs &&
    left.size === right.size &&
    left.contentHash === right.contentHash
  )
}

export function createNodeAtomicFileSaver(options: NodeAtomicFileSaverOptions): AtomicFileSaver {
  return async ({ path, bytes, expectedDiskVersion }) => {
    const replaceFile = options.replaceFile ?? rename
    const wait = options.wait ?? waitForMilliseconds
    const syncParentDirectory = options.syncParentDirectory ?? bestEffortSyncDirectory
    const readSnapshot = createNodeDocumentSnapshotReader({
      maxBytes: Math.max(bytes.byteLength, expectedDiskVersion?.size ?? 0) + 1
    })
    const before = await readOptionalSnapshot(readSnapshot, path)
    if (!sameDiskVersion(before?.diskVersion ?? null, expectedDiskVersion)) {
      return { status: 'conflict', diskVersion: before?.diskVersion ?? null }
    }

    const temporaryPath = join(
      dirname(path),
      `.${basename(path)}.lattice-${options.createTemporaryId()}.tmp`
    )
    let replaced = false
    try {
      const temporary = await open(temporaryPath, 'wx', 0o600)
      try {
        await options.onStage?.('after-temp-create')
        await temporary.writeFile(bytes)
        await options.onStage?.('after-write')
        await temporary.sync()
        await options.onStage?.('after-sync')
      } finally {
        await temporary.close()
      }

      await options.onStage?.('before-replace')
      const beforeReplace = await readOptionalSnapshot(readSnapshot, path)
      if (!sameDiskVersion(beforeReplace?.diskVersion ?? null, expectedDiskVersion)) {
        return { status: 'conflict', diskVersion: beforeReplace?.diskVersion ?? null }
      }

      await replaceWithFiniteRetry(temporaryPath, path, replaceFile, wait)
      replaced = true
      await syncParentDirectory(dirname(path))
      await options.onStage?.('after-replace')
      const after = await readSnapshot(path)
      if (
        after.bytes.byteLength !== bytes.byteLength ||
        after.diskVersion.contentHash !== hashOf(bytes)
      ) {
        throw new Error('Saved document verification failed')
      }
      await options.onStage?.('after-verify')
      return { status: 'saved', diskVersion: after.diskVersion }
    } finally {
      if (!replaced) await rm(temporaryPath, { force: true })
    }
  }
}

async function readOptionalSnapshot(
  readSnapshot: (path: string) => Promise<DocumentFileSnapshot>,
  path: string
): Promise<DocumentFileSnapshot | null> {
  try {
    return await readSnapshot(path)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

async function replaceWithFiniteRetry(
  temporaryPath: string,
  targetPath: string,
  replaceFile: (temporaryPath: string, targetPath: string) => Promise<void>,
  wait: (milliseconds: number) => Promise<void>
): Promise<void> {
  for (let attempt = 0; attempt <= REPLACE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      await replaceFile(temporaryPath, targetPath)
      return
    } catch (error) {
      const delay = REPLACE_RETRY_DELAYS_MS[attempt]
      if (!isOccupiedFileError(error) || delay === undefined) throw error
      await wait(delay)
    }
  }
}

function isOccupiedFileError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) return false
  return error.code === 'EBUSY' || error.code === 'EPERM' || error.code === 'EACCES'
}

function waitForMilliseconds(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function bestEffortSyncDirectory(directory: string): Promise<void> {
  let handle: FileHandle | undefined
  try {
    handle = await open(directory, 'r')
    await handle.sync()
  } catch {
    return
  } finally {
    if (handle !== undefined) await handle.close().catch(() => undefined)
  }
}

function hashOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}
