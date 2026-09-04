import { parser } from '@lezer/markdown'

import { isDocumentSessionDirty, type DocumentSession } from './document-session'
import type { SourceEncoding } from './source-buffer'

export interface TextStatistics {
  readonly characters: number
  readonly words: number
  readonly lines: number
  readonly readingMinutes: number
}

export interface DocumentStatus {
  readonly document: TextStatistics
  readonly selection: TextStatistics | null
  readonly cursor: { readonly line: number; readonly column: number }
  readonly encoding: SourceEncoding
  readonly eol: 'none' | 'lf' | 'crlf' | 'mixed'
  readonly dirty: boolean
  readonly zoomPercent: number
}

export interface DeriveDocumentStatusOptions {
  readonly selection: { readonly anchor: number; readonly head: number }
  readonly readingSpeedWordsPerMinute: number
  readonly zoomPercent: number
}

const WORD_IGNORED_MARKDOWN_NODES = new Set([
  'CodeMark',
  'EmphasisMark',
  'HeaderMark',
  'LinkMark',
  'ListMark',
  'QuoteMark',
  'URL'
])

export function deriveDocumentStatus(
  session: DocumentSession,
  options: DeriveDocumentStatusOptions
): DocumentStatus {
  validateOptions(session.buffer.text, options)
  const from = Math.min(options.selection.anchor, options.selection.head)
  const to = Math.max(options.selection.anchor, options.selection.head)
  const selectedText = session.buffer.text.slice(from, to)

  return {
    document: statisticsFor(session.buffer.text, options.readingSpeedWordsPerMinute),
    selection: from === to ? null : statisticsFor(selectedText, options.readingSpeedWordsPerMinute),
    cursor: cursorPosition(session.buffer.text, options.selection.head),
    encoding: session.buffer.encoding,
    eol: summarizeEol(session.buffer.eolByLine),
    dirty: isDocumentSessionDirty(session),
    zoomPercent: options.zoomPercent
  }
}

function statisticsFor(text: string, readingSpeedWordsPerMinute: number): TextStatistics {
  const words = countWords(text)
  return {
    characters: [...text].length,
    words,
    lines: text.length === 0 ? 0 : countOccurrences(text, '\n') + 1,
    readingMinutes: words === 0 ? 0 : Math.ceil(words / readingSpeedWordsPerMinute)
  }
}

function countWords(source: string): number {
  const ignoredRanges: Array<{ readonly from: number; readonly to: number }> = []
  parser.parse(source).iterate({
    enter: (node) => {
      if (WORD_IGNORED_MARKDOWN_NODES.has(node.name)) {
        ignoredRanges.push({ from: node.from, to: node.to })
      }
    }
  })
  let visibleText = source
  for (const range of ignoredRanges.sort((left, right) => right.from - left.from)) {
    visibleText = `${visibleText.slice(0, range.from)} ${visibleText.slice(range.to)}`
  }

  const chineseCharacters = visibleText.match(/\p{Script=Han}/gu)?.length ?? 0
  const withoutChinese = visibleText.replace(/\p{Script=Han}/gu, ' ')
  const otherWords =
    withoutChinese.match(/[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}'’-]*[\p{L}\p{M}\p{N}])?/gu)?.length ?? 0
  return chineseCharacters + otherWords
}

function cursorPosition(
  text: string,
  offset: number
): { readonly line: number; readonly column: number } {
  const before = text.slice(0, offset)
  const lastLineBreak = before.lastIndexOf('\n')
  return {
    line: countOccurrences(before, '\n') + 1,
    column: offset - lastLineBreak
  }
}

function summarizeEol(eols: readonly ('\n' | '\r\n')[]): DocumentStatus['eol'] {
  if (eols.length === 0) return 'none'
  const hasLf = eols.includes('\n')
  const hasCrlf = eols.includes('\r\n')
  if (hasLf && hasCrlf) return 'mixed'
  return hasCrlf ? 'crlf' : 'lf'
}

function countOccurrences(text: string, character: string): number {
  let count = 0
  for (const current of text) {
    if (current === character) count += 1
  }
  return count
}

function validateOptions(text: string, options: DeriveDocumentStatusOptions): void {
  for (const offset of [options.selection.anchor, options.selection.head]) {
    if (!Number.isInteger(offset) || offset < 0 || offset > text.length) {
      throw new RangeError('Document selection is outside the source')
    }
  }
  if (
    !Number.isFinite(options.readingSpeedWordsPerMinute) ||
    options.readingSpeedWordsPerMinute <= 0
  ) {
    throw new RangeError('Reading speed must be positive')
  }
  if (!Number.isFinite(options.zoomPercent) || options.zoomPercent <= 0) {
    throw new RangeError('Zoom percent must be positive')
  }
}
