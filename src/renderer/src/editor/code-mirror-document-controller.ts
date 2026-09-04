import { history, redo, redoDepth, undo, undoDepth } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState, Transaction, type TransactionSpec } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

import {
  applyDocumentChanges,
  createDocumentReplacementChanges,
  encodeSourceBuffer,
  markDocumentSaved,
  rebaseSourceBuffer,
  redoDocumentChange,
  setDocumentPath,
  undoDocumentChange,
  type DocumentSearchOptions,
  type DocumentSession,
  type SourceChange
} from '../../../domain/documents'
import type { DocumentSaveSnapshot, RecoverySnapshot, SavedFile } from '../../../shared/contracts'

export class CodeMirrorDocumentController {
  private currentState: EditorState
  private currentSession: DocumentSession
  private view: EditorView | null = null
  private readonly listeners = new Set<() => void>()
  private snapshotVersion = 0

  constructor(session: DocumentSession) {
    this.currentSession = session
    this.currentState = EditorState.create({
      doc: session.buffer.text,
      extensions: [history(), markdown()]
    })
  }

  get state(): EditorState {
    return this.currentState
  }

  get session(): DocumentSession {
    return this.currentSession
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = (): number => this.snapshotVersion

  attach(parent: HTMLElement): () => void {
    if (this.view !== null) throw new Error('CodeMirror controller is already attached')
    const view = new EditorView({
      state: this.currentState,
      parent,
      dispatch: (transaction) => {
        this.acceptTransaction(transaction)
        const attachedView = this.view
        if (attachedView !== null) attachedView.update([transaction])
      }
    })
    this.view = view

    return () => {
      if (this.view !== view) return
      this.currentState = view.state
      this.view = null
      view.destroy()
    }
  }

  dispatch(spec: TransactionSpec): void {
    if (this.view !== null) {
      this.view.dispatch(spec)
      return
    }
    this.acceptTransaction(this.currentState.update(spec))
  }

  undo(): boolean {
    return this.view === null ? false : undo(this.view)
  }

  redo(): boolean {
    return this.view === null ? false : redo(this.view)
  }

  canUndo(): boolean {
    return undoDepth(this.currentState) > 0
  }

  canRedo(): boolean {
    return redoDepth(this.currentState) > 0
  }

  createSaveSnapshot(): DocumentSaveSnapshot {
    return {
      documentId: this.currentSession.id,
      revision: this.currentSession.revision,
      text: this.currentSession.buffer.text,
      encoding: this.currentSession.buffer.encoding,
      eolByLine: [...this.currentSession.buffer.eolByLine]
    }
  }

  createRecoverySnapshot(trigger: RecoverySnapshot['trigger']): RecoverySnapshot {
    return {
      ...this.createSaveSnapshot(),
      path: this.currentSession.path,
      currentContentRevision: this.currentSession.currentContentRevision,
      savedRevision: this.currentSession.savedRevision,
      originalBytesHash: this.currentSession.buffer.originalBytesHash,
      diskVersion: this.currentSession.diskVersion,
      trigger
    }
  }

  acceptSavedFile(saved: SavedFile): boolean {
    if (
      saved.revision !== this.currentSession.revision ||
      saved.bytesHash !== saved.diskVersion.contentHash
    ) {
      return false
    }
    const bytes = encodeSourceBuffer(this.currentSession.buffer)
    const buffer = rebaseSourceBuffer(this.currentSession.buffer, bytes, saved.bytesHash)
    this.currentSession = markDocumentSaved(
      setDocumentPath({ ...this.currentSession, buffer }, saved.path),
      { diskVersion: saved.diskVersion }
    )
    this.notify()
    return true
  }

  replaceAll(
    options: DocumentSearchOptions,
    replacement: string
  ):
    | { readonly status: 'replaced'; readonly count: number }
    | { readonly status: 'invalid-pattern'; readonly code: 'SEARCH_INVALID_PATTERN' } {
    const result = createDocumentReplacementChanges(
      this.currentState.doc.toString(),
      options,
      replacement
    )
    if (result.status === 'invalid-pattern') return result
    if (result.changes.length > 0) {
      this.dispatch({
        changes: result.changes,
        annotations: Transaction.userEvent.of('input.replace.all')
      })
    }
    return { status: 'replaced', count: result.changes.length }
  }

  selectRange(from: number, to: number): void {
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      to < from ||
      to > this.currentState.doc.length
    ) {
      throw new RangeError('Selection range is outside the document')
    }
    this.dispatch({
      selection: { anchor: from, head: to },
      effects: EditorView.scrollIntoView(from, { y: 'center' })
    })
  }

  private acceptTransaction(transaction: Transaction): void {
    const changes = sourceChangesFrom(transaction)
    const nextText = transaction.newDoc.toString()
    if (transaction.isUserEvent('undo')) {
      this.currentSession = moveDocumentHistoryToText(this.currentSession, nextText, 'undo')
    } else if (transaction.isUserEvent('redo')) {
      this.currentSession = moveDocumentHistoryToText(this.currentSession, nextText, 'redo')
    } else if (changes.length > 0) {
      this.currentSession = applyDocumentChanges(this.currentSession, changes)
    }

    if (this.currentSession.buffer.text !== nextText) {
      throw new Error('CodeMirror transaction diverged from DocumentSession source')
    }
    this.currentState = transaction.state
    this.notify()
  }

  private notify(): void {
    this.snapshotVersion += 1
    for (const listener of this.listeners) listener()
  }
}

function moveDocumentHistoryToText(
  session: DocumentSession,
  targetText: string,
  direction: 'undo' | 'redo'
): DocumentSession {
  let candidate = session
  const availableSteps =
    direction === 'undo' ? session.historyPast.length : session.historyFuture.length
  for (let step = 0; step < availableSteps; step += 1) {
    candidate = direction === 'undo' ? undoDocumentChange(candidate) : redoDocumentChange(candidate)
    if (candidate.buffer.text === targetText) return candidate
  }
  throw new Error(`CodeMirror ${direction} target is absent from DocumentSession history`)
}

function sourceChangesFrom(transaction: Transaction): readonly SourceChange[] {
  const changes: SourceChange[] = []
  transaction.changes.iterChanges((from, to, _fromNew, _toNew, inserted) => {
    changes.push({ from, to, insert: inserted.toString() })
  })
  return changes
}
