import type { JSX } from 'react'

import type { Locale } from '../i18n/messages'
import { translate } from '../i18n/translate'

export interface UnsavedChangesDialogProps {
  readonly locale: Locale
  readonly documentName: string
  readonly isSaving: boolean
  readonly onSave: () => void
  readonly onDiscard: () => void
  readonly onCancel: () => void
}

export function UnsavedChangesDialog({
  locale,
  documentName,
  isSaving,
  onSave,
  onDiscard,
  onCancel
}: UnsavedChangesDialogProps): JSX.Element {
  return (
    <dialog open className="document-dialog" aria-labelledby="unsaved-changes-title">
      <h2 id="unsaved-changes-title">{translate(locale, 'document.unsaved.title')}</h2>
      <p>{translate(locale, 'document.unsaved.question', { name: documentName })}</p>
      <div className="document-dialog-actions">
        <button type="button" disabled={isSaving} onClick={onSave}>
          {translate(locale, isSaving ? 'document.unsaved.saving' : 'document.unsaved.save')}
        </button>
        <button type="button" disabled={isSaving} onClick={onDiscard}>
          {translate(locale, 'document.unsaved.discard')}
        </button>
        <button type="button" disabled={isSaving} onClick={onCancel}>
          {translate(locale, 'common.cancel')}
        </button>
      </div>
    </dialog>
  )
}
