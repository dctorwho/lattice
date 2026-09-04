import type { SourceChange } from './source-buffer'

export interface DocumentSearchOptions {
  readonly pattern: string
  readonly useRegex: boolean
  readonly caseSensitive: boolean
  readonly wholeWord: boolean
}

export interface DocumentMatch {
  readonly from: number
  readonly to: number
  readonly text: string
  readonly captures: readonly (string | undefined)[]
}

export type DocumentSearchResult =
  | { readonly status: 'matched'; readonly matches: readonly DocumentMatch[] }
  | { readonly status: 'invalid-pattern'; readonly code: 'SEARCH_INVALID_PATTERN' }

export type DocumentReplacementResult =
  | { readonly status: 'ready'; readonly changes: readonly SourceChange[] }
  | { readonly status: 'invalid-pattern'; readonly code: 'SEARCH_INVALID_PATTERN' }

const MAX_PATTERN_CODE_UNITS = 1_024

export function findDocumentMatches(
  source: string,
  options: DocumentSearchOptions
): DocumentSearchResult {
  if (options.pattern.length === 0) return { status: 'matched', matches: [] }
  if (options.pattern.length > MAX_PATTERN_CODE_UNITS) {
    return { status: 'invalid-pattern', code: 'SEARCH_INVALID_PATTERN' }
  }

  let expression: RegExp
  try {
    const pattern = options.useRegex ? options.pattern : escapeRegExp(options.pattern)
    expression = new RegExp(pattern, options.caseSensitive ? 'gmu' : 'gimu')
  } catch {
    return { status: 'invalid-pattern', code: 'SEARCH_INVALID_PATTERN' }
  }

  const matches: DocumentMatch[] = []
  for (;;) {
    const match = expression.exec(source)
    if (match === null) break
    const from = match.index
    const to = from + match[0].length
    if (!options.wholeWord || isWholeWord(source, from, to)) {
      matches.push({ from, to, text: match[0], captures: match.slice(1) })
    }
    if (match[0].length === 0) {
      if (expression.lastIndex >= source.length) break
      expression.lastIndex = nextCodePointOffset(source, expression.lastIndex)
    }
  }
  return { status: 'matched', matches }
}

export function createDocumentReplacementChanges(
  source: string,
  options: DocumentSearchOptions,
  replacement: string
): DocumentReplacementResult {
  const result = findDocumentMatches(source, options)
  if (result.status === 'invalid-pattern') return result
  return {
    status: 'ready',
    changes: result.matches.map((match) => ({
      from: match.from,
      to: match.to,
      insert: options.useRegex
        ? expandRegexReplacement(replacement, match.text, match.captures)
        : replacement
    }))
  }
}

function expandRegexReplacement(
  replacement: string,
  matchedText: string,
  captures: readonly (string | undefined)[]
): string {
  let expanded = ''
  for (let index = 0; index < replacement.length; index += 1) {
    const character = replacement[index]
    const next = replacement[index + 1]
    if (character !== '$' || next === undefined) {
      expanded += character
      continue
    }
    if (next === '$') {
      expanded += '$'
      index += 1
      continue
    }
    if (next === '&') {
      expanded += matchedText
      index += 1
      continue
    }
    if (!/[1-9]/u.test(next)) {
      expanded += '$'
      continue
    }
    const secondDigit = replacement[index + 2]
    const captureNumber =
      secondDigit !== undefined && /\d/u.test(secondDigit)
        ? Number.parseInt(`${next}${secondDigit}`, 10)
        : Number.parseInt(next, 10)
    const capture = captures[captureNumber - 1]
    if (capture === undefined) {
      expanded += `$${next}`
    } else {
      expanded += capture
    }
    index += captureNumber >= 10 ? 2 : 1
  }
  return expanded
}

function isWholeWord(source: string, from: number, to: number): boolean {
  const before = [...source.slice(0, from)].at(-1)
  const after = [...source.slice(to)][0]
  return !isWordCharacter(before) && !isWordCharacter(after)
}

function isWordCharacter(character: string | undefined): boolean {
  return character !== undefined && /[\p{L}\p{M}\p{N}_]/u.test(character)
}

function nextCodePointOffset(source: string, offset: number): number {
  const codePoint = source.codePointAt(offset)
  return offset + (codePoint !== undefined && codePoint > 0xffff ? 2 : 1)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}
