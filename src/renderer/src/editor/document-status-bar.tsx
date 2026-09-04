import { useSyncExternalStore, type JSX } from 'react'

import { deriveDocumentStatus } from '../../../domain/documents'
import type { CodeMirrorDocumentController } from './code-mirror-document-controller'
import type { Locale } from '../i18n/messages'
import { translate } from '../i18n/translate'

const LARGE_FILE_THRESHOLD_BYTES = 5 * 1024 * 1024

export interface DocumentStatusBarProps {
  readonly locale: Locale
  readonly controller: CodeMirrorDocumentController
}

export function DocumentStatusBar({ locale, controller }: DocumentStatusBarProps): JSX.Element {
  useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const session = controller.session
  const isLargeFile =
    Math.max(session.diskVersion?.size ?? 0, session.buffer.text.length) >=
    LARGE_FILE_THRESHOLD_BYTES

  if (isLargeFile) {
    const dirty = session.currentContentRevision !== session.savedRevision
    return (
      <footer className="status-bar" role="status" aria-live="polite">
        <span>{translate(locale, dirty ? 'documentStatus.dirty' : 'documentStatus.saved')}</span>
        <span>{encodingLabel(session.buffer.encoding)}</span>
        <span>{translate(locale, 'documentStatus.largeFile')}</span>
      </footer>
    )
  }

  const selection = controller.state.selection.main
  const status = deriveDocumentStatus(session, {
    selection: { anchor: selection.anchor, head: selection.head },
    readingSpeedWordsPerMinute: 200,
    zoomPercent: 100
  })
  return (
    <footer className="status-bar" role="status" aria-live="polite">
      <span>
        {translate(locale, status.dirty ? 'documentStatus.dirty' : 'documentStatus.saved')}
      </span>
      <span>{translate(locale, 'documentStatus.words', { count: status.document.words })}</span>
      <span>
        {translate(locale, 'documentStatus.characters', { count: status.document.characters })}
      </span>
      <span>{translate(locale, 'documentStatus.lines', { count: status.document.lines })}</span>
      <span>
        {translate(locale, 'documentStatus.readingTime', {
          count: status.document.readingMinutes
        })}
      </span>
      {status.selection !== null && (
        <span>
          {translate(locale, 'documentStatus.selected')}
          {translate(locale, 'documentStatus.words', { count: status.selection.words })}
        </span>
      )}
      <span>{translate(locale, 'documentStatus.cursor', status.cursor)}</span>
      <span>{encodingLabel(status.encoding)}</span>
      <span>{eolLabel(locale, status.eol)}</span>
      <span>{status.zoomPercent}%</span>
    </footer>
  )
}

function encodingLabel(encoding: ReturnType<typeof deriveDocumentStatus>['encoding']): string {
  switch (encoding) {
    case 'utf8':
      return 'UTF-8'
    case 'utf8-bom':
      return 'UTF-8 BOM'
    case 'utf16le':
      return 'UTF-16 LE'
    case 'utf16be':
      return 'UTF-16 BE'
  }
}

function eolLabel(locale: Locale, eol: ReturnType<typeof deriveDocumentStatus>['eol']): string {
  switch (eol) {
    case 'none':
      return translate(locale, 'documentStatus.noEol')
    case 'lf':
      return 'LF'
    case 'crlf':
      return 'CRLF'
    case 'mixed':
      return translate(locale, 'documentStatus.mixedEol')
  }
}
