import { createHash } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { mkdir, open, readFile, readdir, rename, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { z } from 'zod'

import {
  decodeSourceBuffer,
  encodeSourceBuffer,
  type DiskVersion,
  type DocumentSession,
  type SourceBuffer
} from '../../domain/documents'

const diskVersionSchema = z
  .object({
    mtimeMs: z.number().finite(),
    size: z.number().int().nonnegative(),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u)
  })
  .strict()

const recoveryMetadataSchema = z
  .object({
    schemaVersion: z.literal(1),
    sessionId: z.uuid(),
    revision: z.number().int().nonnegative(),
    currentContentRevision: z.number().int().nonnegative(),
    savedRevision: z.number().int().nonnegative(),
    createdAtMs: z.number().int().nonnegative(),
    path: z.string().nullable(),
    diskVersion: diskVersionSchema.nullable(),
    bodyFile: z.string().regex(/^\d{16}\.body$/u),
    bodyHash: z.string().regex(/^[a-f0-9]{64}$/u)
  })
  .strict()

const sessionIdSchema = z.uuid()

type RecoveryMetadata = z.infer<typeof recoveryMetadataSchema>

export interface RecoveryDiagnostic {
  readonly code: 'RECOVERY_CORRUPT'
  readonly sessionId: string
  readonly revision: number
}

export interface RecoveryRecord {
  readonly sessionId: string
  readonly revision: number
  readonly currentContentRevision: number
  readonly savedRevision: number
  readonly createdAtMs: number
  readonly path: string | null
  readonly diskVersion: DiskVersion | null
  readonly buffer: SourceBuffer
}

export interface NodeRecoveryStoreOptions {
  readonly rootDirectory: string
  readonly createTemporaryId: () => string
  readonly now: () => number
  readonly reportDiagnostic?: (diagnostic: RecoveryDiagnostic) => void
}

export interface NodeRecoveryStore {
  readonly write: (session: DocumentSession) => Promise<void>
  readonly list: () => Promise<readonly RecoveryRecord[]>
  readonly discard: (sessionId: string) => Promise<void>
}

export function createNodeRecoveryStore(options: NodeRecoveryStoreOptions): NodeRecoveryStore {
  return {
    write: (session) => writeRecoverySnapshot(options, session),
    list: () => listRecoverySnapshots(options),
    discard: async (sessionId) => {
      const validatedSessionId = sessionIdSchema.parse(sessionId)
      await rm(join(options.rootDirectory, validatedSessionId), { force: true, recursive: true })
    }
  }
}

async function writeRecoverySnapshot(
  options: NodeRecoveryStoreOptions,
  session: DocumentSession
): Promise<void> {
  const sessionId = sessionIdSchema.parse(session.id)
  const directory = join(options.rootDirectory, sessionId)
  await mkdir(directory, { recursive: true })
  const stem = revisionStem(session.revision)
  const bodyFile = `${stem}.body`
  const bytes = encodeSourceBuffer(session.buffer)
  const metadata: RecoveryMetadata = {
    schemaVersion: 1,
    sessionId,
    revision: session.revision,
    currentContentRevision: session.currentContentRevision,
    savedRevision: session.savedRevision,
    createdAtMs: options.now(),
    path: session.path,
    diskVersion: session.diskVersion,
    bodyFile,
    bodyHash: hashOf(bytes)
  }
  const temporaryId = options.createTemporaryId()
  await writeAtomicFile(directory, bodyFile, bytes, `${temporaryId}.body.tmp`)
  await writeAtomicFile(
    directory,
    `${stem}.meta.json`,
    new TextEncoder().encode(JSON.stringify(metadata)),
    `${temporaryId}.meta.tmp`
  )
}

async function listRecoverySnapshots(
  options: NodeRecoveryStoreOptions
): Promise<readonly RecoveryRecord[]> {
  let entries: Dirent<string>[]
  try {
    entries = await readdir(options.rootDirectory, { withFileTypes: true })
  } catch (error) {
    if (isMissingPathError(error)) return []
    throw error
  }
  const records: RecoveryRecord[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const record = await latestValidRecord(options, entry.name)
    if (record !== null) records.push(record)
  }
  return records.sort((left, right) => left.sessionId.localeCompare(right.sessionId))
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

async function latestValidRecord(
  options: NodeRecoveryStoreOptions,
  sessionId: string
): Promise<RecoveryRecord | null> {
  const directory = join(options.rootDirectory, sessionId)
  const metadataFiles = (await readdir(directory))
    .filter((name) => /^\d{16}\.meta\.json$/u.test(name))
    .sort()
    .reverse()

  for (const metadataFile of metadataFiles) {
    const revision = Number.parseInt(metadataFile.slice(0, 16), 10)
    try {
      const metadataText = await readFile(join(directory, metadataFile), 'utf8')
      const metadata = recoveryMetadataSchema.parse(JSON.parse(metadataText))
      if (metadata.sessionId !== sessionId || metadata.revision !== revision) {
        throw new Error('Recovery metadata identity does not match its directory')
      }
      const bytes = await readFile(join(directory, metadata.bodyFile))
      if (hashOf(bytes) !== metadata.bodyHash) {
        throw new Error('Recovery body checksum mismatch')
      }
      const decoded = decodeSourceBuffer(bytes, metadata.bodyHash)
      if (decoded.status !== 'editable') {
        throw new Error('Recovery body encoding is unsupported')
      }
      return recordFrom(metadata, decoded.buffer)
    } catch {
      safelyReport(options, { code: 'RECOVERY_CORRUPT', sessionId, revision })
    }
  }
  return null
}

function recordFrom(metadata: RecoveryMetadata, buffer: SourceBuffer): RecoveryRecord {
  return {
    sessionId: metadata.sessionId,
    revision: metadata.revision,
    currentContentRevision: metadata.currentContentRevision,
    savedRevision: metadata.savedRevision,
    createdAtMs: metadata.createdAtMs,
    path: metadata.path,
    diskVersion: metadata.diskVersion,
    buffer
  }
}

async function writeAtomicFile(
  directory: string,
  fileName: string,
  bytes: Uint8Array,
  temporaryName: string
): Promise<void> {
  const temporaryPath = join(directory, temporaryName)
  const targetPath = join(directory, fileName)
  const handle = await open(temporaryPath, 'wx', 0o600)
  try {
    await handle.writeFile(bytes)
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(temporaryPath, targetPath)
}

function safelyReport(options: NodeRecoveryStoreOptions, diagnostic: RecoveryDiagnostic): void {
  try {
    options.reportDiagnostic?.(diagnostic)
  } catch {
    return
  }
}

function revisionStem(revision: number): string {
  if (!Number.isSafeInteger(revision) || revision < 0 || revision > Number.MAX_SAFE_INTEGER) {
    throw new RangeError('Recovery revision is outside the supported range')
  }
  return revision.toString().padStart(16, '0')
}

function hashOf(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}
