import { createHash } from 'node:crypto'
import { open, realpath } from 'node:fs/promises'

import type { DiskVersion } from '../../domain/documents'

export interface DocumentFileSnapshot {
  readonly authorizedPath: string
  readonly bytes: Uint8Array
  readonly diskVersion: DiskVersion
}

export type DocumentSnapshotReader = (path: string) => Promise<DocumentFileSnapshot>

export interface NodeDocumentSnapshotReaderOptions {
  readonly maxBytes: number
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function sameStat(
  left: { readonly size: number; readonly mtimeMs: number },
  right: { readonly size: number; readonly mtimeMs: number }
): boolean {
  return left.size === right.size && left.mtimeMs === right.mtimeMs
}

export function createNodeDocumentSnapshotReader(
  options: NodeDocumentSnapshotReaderOptions
): DocumentSnapshotReader {
  return async (selectedPath) => {
    const authorizedPath = await realpath(selectedPath)
    const handle = await open(authorizedPath, 'r')

    try {
      const before = await handle.stat()
      if (!before.isFile()) throw new Error('Selected document is not a regular file')
      if (before.size > options.maxBytes) throw new Error('Selected document exceeds byte limit')

      const bytes = new Uint8Array(await handle.readFile())
      const after = await handle.stat()
      if (!sameStat(before, after) || bytes.byteLength !== after.size) {
        throw new Error('Selected document changed while it was being read')
      }

      return {
        authorizedPath,
        bytes,
        diskVersion: {
          mtimeMs: after.mtimeMs,
          size: after.size,
          contentHash: sha256(bytes)
        }
      }
    } finally {
      await handle.close()
    }
  }
}
