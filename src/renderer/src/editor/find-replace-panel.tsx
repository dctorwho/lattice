import { useMemo, useState, type JSX } from 'react'

import { findDocumentMatches, type DocumentSearchOptions } from '../../../domain/documents'
import type { CodeMirrorDocumentController } from './code-mirror-document-controller'
import type { Locale } from '../i18n/messages'
import { translate } from '../i18n/translate'

export interface FindReplacePanelProps {
  readonly locale: Locale
  readonly mode: 'find' | 'replace'
  readonly controller: CodeMirrorDocumentController
  readonly onClose: () => void
}

export function FindReplacePanel({
  locale,
  mode,
  controller,
  onClose
}: FindReplacePanelProps): JSX.Element {
  const [pattern, setPattern] = useState('')
  const [replacement, setReplacement] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [replacementNotice, setReplacementNotice] = useState<string | null>(null)
  const options = useMemo<DocumentSearchOptions>(
    () => ({ pattern, useRegex, caseSensitive, wholeWord }),
    [caseSensitive, pattern, useRegex, wholeWord]
  )
  const result = findDocumentMatches(controller.session.buffer.text, options)

  const replaceAll = (): void => {
    const outcome = controller.replaceAll(options, replacement)
    setReplacementNotice(
      outcome.status === 'invalid-pattern'
        ? translate(locale, 'errors.search.invalidPattern')
        : translate(locale, 'search.replaced', { count: outcome.count })
    )
  }

  const selectMatch = (direction: 'previous' | 'next'): void => {
    if (result.status !== 'matched' || result.matches.length === 0) return
    const selection = controller.state.selection.main
    const match =
      direction === 'next'
        ? (result.matches.find((candidate) => candidate.from >= selection.to) ?? result.matches[0])
        : ([...result.matches].reverse().find((candidate) => candidate.to <= selection.from) ??
          result.matches.at(-1))
    if (match !== undefined) controller.selectRange(match.from, match.to)
  }

  return (
    <section
      className="find-replace-panel"
      aria-label={translate(locale, mode === 'find' ? 'search.find' : 'search.replace')}
    >
      <label>
        {translate(locale, 'search.find')}
        <input
          autoFocus
          value={pattern}
          onChange={(event) => {
            setPattern(event.currentTarget.value)
            setReplacementNotice(null)
          }}
        />
      </label>
      {mode === 'replace' && (
        <label>
          {translate(locale, 'search.replaceWith')}
          <input
            value={replacement}
            onChange={(event) => setReplacement(event.currentTarget.value)}
          />
        </label>
      )}
      <label>
        <input
          type="checkbox"
          checked={caseSensitive}
          onChange={(event) => setCaseSensitive(event.currentTarget.checked)}
        />
        {translate(locale, 'search.caseSensitive')}
      </label>
      <label>
        <input
          type="checkbox"
          checked={wholeWord}
          onChange={(event) => setWholeWord(event.currentTarget.checked)}
        />
        {translate(locale, 'search.wholeWord')}
      </label>
      <label>
        <input
          type="checkbox"
          checked={useRegex}
          onChange={(event) => setUseRegex(event.currentTarget.checked)}
        />
        {translate(locale, 'search.regex')}
      </label>
      <output aria-live="polite">
        {result.status === 'invalid-pattern'
          ? translate(locale, 'errors.search.invalidPattern')
          : translate(locale, 'search.matches', { count: result.matches.length })}
      </output>
      <button type="button" onClick={() => selectMatch('previous')}>
        {translate(locale, 'search.previous')}
      </button>
      <button type="button" onClick={() => selectMatch('next')}>
        {translate(locale, 'search.next')}
      </button>
      {mode === 'replace' && (
        <button type="button" onClick={replaceAll}>
          {translate(locale, 'search.replaceAll')}
        </button>
      )}
      {replacementNotice !== null && <p role="status">{replacementNotice}</p>}
      <button type="button" onClick={onClose} aria-label={translate(locale, 'search.close')}>
        {translate(locale, 'common.close')}
      </button>
    </section>
  )
}
