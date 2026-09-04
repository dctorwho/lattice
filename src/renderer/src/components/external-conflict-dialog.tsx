import { useState, type JSX } from 'react'

import type { FileSaveOutcome } from '../../../shared/contracts'
import type { Locale } from '../i18n/messages'
import { translate } from '../i18n/translate'

type FileConflict = Extract<FileSaveOutcome, { readonly status: 'conflict' }>

export interface ExternalConflictDialogProps {
  readonly locale: Locale
  readonly conflict: FileConflict
  readonly localText: string
  readonly onReload: () => void
  readonly onSaveAs: () => void
  readonly onOverwrite: () => void
  readonly onCancel: () => void
}

export function ExternalConflictDialog({
  locale,
  conflict,
  localText,
  onReload,
  onSaveAs,
  onOverwrite,
  onCancel
}: ExternalConflictDialogProps): JSX.Element {
  const [showComparison, setShowComparison] = useState(false)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)

  return (
    <dialog open className="document-dialog conflict-dialog" aria-labelledby="conflict-title">
      <h2 id="conflict-title">{translate(locale, 'conflict.title')}</h2>
      <p>{translate(locale, 'conflict.description')}</p>
      <button type="button" onClick={() => setShowComparison((visible) => !visible)}>
        {translate(locale, showComparison ? 'conflict.collapse' : 'conflict.compare')}
      </button>
      {showComparison && (
        <div className="conflict-comparison">
          <section aria-label={translate(locale, 'conflict.localVersion')}>
            <h3>{translate(locale, 'conflict.localVersion')}</h3>
            <pre>{localText}</pre>
          </section>
          <section aria-label={translate(locale, 'conflict.diskVersion')}>
            <h3>{translate(locale, 'conflict.diskVersion')}</h3>
            <pre>
              {conflict.external.accessMode === 'editable'
                ? conflict.external.text
                : translate(locale, 'conflict.unsupportedDiskText')}
            </pre>
          </section>
        </div>
      )}
      <div className="document-dialog-actions">
        <button
          type="button"
          disabled={conflict.external.accessMode !== 'editable'}
          onClick={onReload}
        >
          {translate(locale, 'conflict.reload')}
        </button>
        <button type="button" onClick={onSaveAs}>
          {translate(locale, 'conflict.saveAs')}
        </button>
        {confirmOverwrite ? (
          <button type="button" className="danger" onClick={onOverwrite}>
            {translate(locale, 'conflict.confirmOverwrite')}
          </button>
        ) : (
          <button type="button" onClick={() => setConfirmOverwrite(true)}>
            {translate(locale, 'conflict.overwrite')}
          </button>
        )}
        <button type="button" onClick={onCancel}>
          {translate(locale, 'common.cancel')}
        </button>
      </div>
    </dialog>
  )
}
