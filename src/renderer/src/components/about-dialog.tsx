import { useEffect, useRef, type JSX } from 'react'

import type { AboutState } from '../commands/use-command-controller'
import type { Locale } from '../i18n/messages'
import { translate } from '../i18n/translate'

interface AboutDialogProps {
  readonly state: Exclude<AboutState, { readonly status: 'closed' }>
  readonly locale: Locale
  readonly onClose: () => void
}

export function AboutDialog({ state, locale, onClose }: AboutDialogProps): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog !== null && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    closeRef.current?.focus()
    return () => {
      if (dialog?.open === true && typeof dialog.close === 'function') dialog.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="about-dialog"
      aria-labelledby="about-dialog-title"
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <h2 id="about-dialog-title">{translate(locale, 'commands.app.about')}</h2>
      {state.status === 'loading' && <p>{translate(locale, 'about.loading')}</p>}
      {state.status === 'ready' && (
        <dl>
          <div>
            <dt>{translate(locale, 'about.name')}</dt>
            <dd>{state.info.name}</dd>
          </div>
          <div>
            <dt>{translate(locale, 'about.version')}</dt>
            <dd>{state.info.version}</dd>
          </div>
          <div>
            <dt>{translate(locale, 'about.platform')}</dt>
            <dd>{state.info.platform}</dd>
          </div>
          <div>
            <dt>{translate(locale, 'about.contractVersion')}</dt>
            <dd>{state.info.contractVersion}</dd>
          </div>
        </dl>
      )}
      {state.status === 'error' && <p role="alert">{translate(locale, state.messageKey)}</p>}
      <button ref={closeRef} type="button" onClick={onClose}>
        {translate(locale, 'about.close')}
      </button>
    </dialog>
  )
}
