import {
  applySourceChange,
  decodeSourceBuffer,
  type SourceBuffer,
  type SourceChange
} from './source-buffer'

const EMPTY_SOURCE_SHA_256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

export interface DiskVersion {
  readonly mtimeMs: number
  readonly size: number
  readonly contentHash: string
}

export type ExternalDocumentState = 'clean' | 'changed' | 'deleted' | 'unknown'

interface DocumentHistoryEntry {
  readonly buffer: SourceBuffer
  readonly contentRevision: number
}

export interface DocumentSession {
  readonly id: string
  readonly path: string | null
  readonly buffer: SourceBuffer
  readonly revision: number
  readonly currentContentRevision: number
  readonly savedRevision: number
  readonly diskVersion: DiskVersion | null
  readonly externalState: ExternalDocumentState
  readonly historyPast: readonly DocumentHistoryEntry[]
  readonly historyFuture: readonly DocumentHistoryEntry[]
}

export interface CreateDocumentSessionInput {
  readonly id: string
  readonly path: string | null
  readonly buffer: SourceBuffer
  readonly diskVersion: DiskVersion | null
}

export interface RestoreDocumentSessionInput extends CreateDocumentSessionInput {
  readonly revision: number
  readonly currentContentRevision: number
  readonly savedRevision: number
}

export interface MarkDocumentSavedInput {
  readonly diskVersion: DiskVersion
}

function currentHistoryEntry(session: DocumentSession): DocumentHistoryEntry {
  return {
    buffer: session.buffer,
    contentRevision: session.currentContentRevision
  }
}

export function createDocumentSession(input: CreateDocumentSessionInput): DocumentSession {
  return {
    id: input.id,
    path: input.path,
    buffer: input.buffer,
    revision: 0,
    currentContentRevision: 0,
    savedRevision: 0,
    diskVersion: input.diskVersion,
    externalState: 'clean',
    historyPast: [],
    historyFuture: []
  }
}

export function createUntitledDocumentSession(id: string): DocumentSession {
  const decoded = decodeSourceBuffer(new Uint8Array(), EMPTY_SOURCE_SHA_256)
  if (decoded.status !== 'editable') {
    throw new Error('Empty UTF-8 source must always be editable')
  }
  return createDocumentSession({ id, path: null, buffer: decoded.buffer, diskVersion: null })
}

export function restoreDocumentSession(input: RestoreDocumentSessionInput): DocumentSession {
  for (const revision of [input.revision, input.currentContentRevision, input.savedRevision]) {
    if (!Number.isSafeInteger(revision) || revision < 0 || revision > input.revision) {
      throw new RangeError('Recovered document revision is invalid')
    }
  }

  return {
    id: input.id,
    path: input.path,
    buffer: input.buffer,
    revision: input.revision,
    currentContentRevision: input.currentContentRevision,
    savedRevision: input.savedRevision,
    diskVersion: input.diskVersion,
    externalState: 'unknown',
    historyPast: [],
    historyFuture: []
  }
}

export function isDocumentSessionDirty(session: DocumentSession): boolean {
  return session.currentContentRevision !== session.savedRevision
}

export function applyDocumentChange(
  session: DocumentSession,
  change: SourceChange
): DocumentSession {
  return applyDocumentChanges(session, [change])
}

export function applyDocumentChanges(
  session: DocumentSession,
  changes: readonly SourceChange[]
): DocumentSession {
  let buffer = session.buffer
  for (const change of [...changes].sort((left, right) => right.from - left.from)) {
    buffer = applySourceChange(buffer, change)
  }
  if (
    buffer.text === session.buffer.text &&
    buffer.eolByLine.length === session.buffer.eolByLine.length &&
    buffer.eolByLine.every((eol, index) => eol === session.buffer.eolByLine[index])
  ) {
    return session
  }

  const revision = session.revision + 1
  return {
    ...session,
    buffer,
    revision,
    currentContentRevision: revision,
    historyPast: [...session.historyPast, currentHistoryEntry(session)],
    historyFuture: []
  }
}

export function undoDocumentChange(session: DocumentSession): DocumentSession {
  const previous = session.historyPast.at(-1)
  if (previous === undefined) return session

  return {
    ...session,
    buffer: previous.buffer,
    revision: session.revision + 1,
    currentContentRevision: previous.contentRevision,
    historyPast: session.historyPast.slice(0, -1),
    historyFuture: [currentHistoryEntry(session), ...session.historyFuture]
  }
}

export function redoDocumentChange(session: DocumentSession): DocumentSession {
  const next = session.historyFuture[0]
  if (next === undefined) return session

  return {
    ...session,
    buffer: next.buffer,
    revision: session.revision + 1,
    currentContentRevision: next.contentRevision,
    historyPast: [...session.historyPast, currentHistoryEntry(session)],
    historyFuture: session.historyFuture.slice(1)
  }
}

export function markDocumentSaved(
  session: DocumentSession,
  input: MarkDocumentSavedInput
): DocumentSession {
  return {
    ...session,
    savedRevision: session.currentContentRevision,
    diskVersion: input.diskVersion,
    externalState: 'clean'
  }
}

export function setDocumentPath(session: DocumentSession, path: string | null): DocumentSession {
  if (session.path === path) return session
  return { ...session, path }
}

export function setDocumentExternalState(
  session: DocumentSession,
  externalState: ExternalDocumentState
): DocumentSession {
  if (session.externalState === externalState) return session
  return { ...session, externalState }
}

export function reloadDocumentFromDisk(
  session: DocumentSession,
  input: { readonly buffer: SourceBuffer; readonly diskVersion: DiskVersion }
): DocumentSession {
  const revision = session.revision + 1
  return {
    ...session,
    buffer: input.buffer,
    revision,
    currentContentRevision: revision,
    savedRevision: revision,
    diskVersion: input.diskVersion,
    externalState: 'clean',
    historyPast: [...session.historyPast, currentHistoryEntry(session)],
    historyFuture: []
  }
}
