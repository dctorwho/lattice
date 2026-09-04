import type { JSX } from 'react'

import type { RecoveryRecord } from '../../../shared/contracts'
import type { Locale } from '../i18n/messages'
import { translate } from '../i18n/translate'

export interface RecoveryDialogProps {
  readonly locale: Locale
  readonly records: readonly RecoveryRecord[]
  readonly onRecover: (record: RecoveryRecord) => void
  readonly onDiscard: (record: RecoveryRecord) => void
  readonly onClose: () => void
}

export function RecoveryDialog({
  locale,
  records,
  onRecover,
  onDiscard,
  onClose
}: RecoveryDialogProps): JSX.Element {
  return (
    <dialog open className="document-dialog" aria-labelledby="recovery-dialog-title">
      <h2 id="recovery-dialog-title">{translate(locale, 'recovery.title')}</h2>
      <p>{translate(locale, 'recovery.description')}</p>
      <ul className="recovery-list">
        {records.map((record) => (
          <li key={record.documentId}>
            <span>
              {record.path?.split(/[\\/]/u).at(-1) ?? translate(locale, 'document.untitled')}
            </span>
            <time dateTime={new Date(record.createdAtMs).toISOString()}>
              {new Date(record.createdAtMs).toLocaleString(locale)}
            </time>
            <button type="button" onClick={() => onRecover(record)}>
              {translate(locale, 'recovery.recover')}
            </button>
            <button type="button" onClick={() => onDiscard(record)}>
              {translate(locale, 'recovery.discard')}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClose}>
        {translate(locale, 'recovery.later')}
      </button>
    </dialog>
  )
}
