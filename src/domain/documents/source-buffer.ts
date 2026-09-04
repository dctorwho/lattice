export type SourceEncoding = 'utf8' | 'utf8-bom' | 'utf16le' | 'utf16be'
export type SourceEol = '\n' | '\r\n'

export interface SourceBuffer {
  readonly text: string
  readonly encoding: SourceEncoding
  readonly eolByLine: readonly SourceEol[]
  readonly originalBytesHash: string
  readonly originalBytes: Uint8Array
  readonly originalText: string
  readonly originalEolByLine: readonly SourceEol[]
}

export interface SourceChange {
  readonly from: number
  readonly to: number
  readonly insert: string
}

export interface CreateSourceBufferFromTextInput {
  readonly text: string
  readonly encoding: SourceEncoding
  readonly eolByLine: readonly SourceEol[]
  readonly originalBytesHash: string
}

export type DecodeSourceBufferResult =
  | { readonly status: 'editable'; readonly buffer: SourceBuffer }
  | {
      readonly status: 'read-only'
      readonly reason: 'unsupported-encoding'
      readonly originalBytes: Uint8Array
      readonly originalBytesHash: string
    }

interface DecodedText {
  readonly text: string
  readonly eolByLine: readonly SourceEol[]
}

const UTF8_BOM = Uint8Array.from([0xef, 0xbb, 0xbf])
const UTF16_LE_BOM = Uint8Array.from([0xff, 0xfe])
const UTF16_BE_BOM = Uint8Array.from([0xfe, 0xff])
const UTF32_LE_BOM = Uint8Array.from([0xff, 0xfe, 0x00, 0x00])
const UTF32_BE_BOM = Uint8Array.from([0x00, 0x00, 0xfe, 0xff])

function startsWith(bytes: Uint8Array, prefix: Uint8Array): boolean {
  if (bytes.length < prefix.length) return false
  return prefix.every((value, index) => bytes[index] === value)
}

function looksLikeUtf32(bytes: Uint8Array, littleEndian: boolean): boolean {
  if (bytes.length < 8 || (bytes.length - 4) % 4 !== 0) return false

  for (let index = 4; index < bytes.length; index += 4) {
    const first = bytes[index]
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    const fourth = bytes[index + 3]
    if (
      first === undefined ||
      second === undefined ||
      third === undefined ||
      fourth === undefined
    ) {
      return false
    }
    const codePoint = littleEndian
      ? first + second * 0x100 + third * 0x1_0000 + fourth * 0x100_0000
      : fourth + third * 0x100 + second * 0x1_0000 + first * 0x100_0000
    if (codePoint > 0x10_ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return false
  }

  return true
}

function splitLineEndings(value: string): DecodedText {
  const eolByLine: SourceEol[] = []
  let text = ''
  let cursor = 0

  for (const match of value.matchAll(/\r\n|\n/g)) {
    const index = match.index
    text += value.slice(cursor, index)
    text += '\n'
    eolByLine.push(match[0] === '\r\n' ? '\r\n' : '\n')
    cursor = index + match[0].length
  }

  return { text: text + value.slice(cursor), eolByLine }
}

function decodeBytes(bytes: Uint8Array): { encoding: SourceEncoding; text: string } | null {
  if (
    (startsWith(bytes, UTF32_LE_BOM) && looksLikeUtf32(bytes, true)) ||
    (startsWith(bytes, UTF32_BE_BOM) && looksLikeUtf32(bytes, false))
  ) {
    return null
  }

  let encoding: SourceEncoding = 'utf8'
  let payload = bytes

  if (startsWith(bytes, UTF8_BOM)) {
    encoding = 'utf8-bom'
    payload = bytes.slice(UTF8_BOM.length)
  } else if (startsWith(bytes, UTF16_LE_BOM)) {
    encoding = 'utf16le'
    payload = bytes.slice(UTF16_LE_BOM.length)
  } else if (startsWith(bytes, UTF16_BE_BOM)) {
    encoding = 'utf16be'
    payload = bytes.slice(UTF16_BE_BOM.length)
  }

  try {
    const decoderName =
      encoding === 'utf16le' ? 'utf-16le' : encoding === 'utf16be' ? 'utf-16be' : 'utf-8'
    return { encoding, text: new TextDecoder(decoderName, { fatal: true }).decode(payload) }
  } catch {
    return null
  }
}

function countLineBreaks(value: string): number {
  let count = 0
  for (const character of value) {
    if (character === '\n') count += 1
  }
  return count
}

function dominantEol(eols: readonly SourceEol[]): SourceEol {
  let lf = 0
  let crlf = 0
  for (const eol of eols) {
    if (eol === '\r\n') crlf += 1
    else lf += 1
  }
  return crlf > lf ? '\r\n' : '\n'
}

function encodeUtf16(text: string, littleEndian: boolean): Uint8Array {
  const bytes = new Uint8Array(2 + text.length * 2)
  bytes.set(littleEndian ? UTF16_LE_BOM : UTF16_BE_BOM)

  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index)
    const offset = 2 + index * 2
    bytes[offset] = littleEndian ? codeUnit & 0xff : codeUnit >>> 8
    bytes[offset + 1] = littleEndian ? codeUnit >>> 8 : codeUnit & 0xff
  }

  return bytes
}

function restoreLineEndings(buffer: Pick<SourceBuffer, 'text' | 'eolByLine'>): string {
  let result = ''
  let cursor = 0
  let eolIndex = 0

  for (let index = 0; index < buffer.text.length; index += 1) {
    if (buffer.text[index] !== '\n') continue
    const eol = buffer.eolByLine[eolIndex]
    if (eol === undefined) throw new Error('SourceBuffer EOL index is incomplete')
    result += buffer.text.slice(cursor, index)
    result += eol
    cursor = index + 1
    eolIndex += 1
  }

  if (eolIndex !== buffer.eolByLine.length) {
    throw new Error('SourceBuffer EOL index contains extra entries')
  }
  return result + buffer.text.slice(cursor)
}

function sameEols(left: readonly SourceEol[], right: readonly SourceEol[]): boolean {
  return left.length === right.length && left.every((eol, index) => eol === right[index])
}

export function decodeSourceBuffer(
  input: Uint8Array,
  originalBytesHash: string
): DecodeSourceBufferResult {
  const originalBytes = input.slice()
  const decoded = decodeBytes(originalBytes)
  if (decoded === null) {
    return {
      status: 'read-only',
      reason: 'unsupported-encoding',
      originalBytes,
      originalBytesHash
    }
  }

  const normalized = splitLineEndings(decoded.text)
  return {
    status: 'editable',
    buffer: {
      text: normalized.text,
      encoding: decoded.encoding,
      eolByLine: normalized.eolByLine,
      originalBytesHash,
      originalBytes,
      originalText: normalized.text,
      originalEolByLine: normalized.eolByLine
    }
  }
}

export function encodeSourceBuffer(buffer: SourceBuffer): Uint8Array {
  if (buffer.text === buffer.originalText && sameEols(buffer.eolByLine, buffer.originalEolByLine)) {
    return buffer.originalBytes.slice()
  }

  return encodeNormalizedSource(buffer.text, buffer.encoding, buffer.eolByLine)
}

function encodeNormalizedSource(
  normalizedText: string,
  encoding: SourceEncoding,
  eolByLine: readonly SourceEol[]
): Uint8Array {
  const text = restoreLineEndings({ text: normalizedText, eolByLine })
  if (encoding === 'utf16le') return encodeUtf16(text, true)
  if (encoding === 'utf16be') return encodeUtf16(text, false)

  const payload = new TextEncoder().encode(text)
  if (encoding === 'utf8') return payload

  const bytes = new Uint8Array(UTF8_BOM.length + payload.length)
  bytes.set(UTF8_BOM)
  bytes.set(payload, UTF8_BOM.length)
  return bytes
}

export function createSourceBufferFromText(input: CreateSourceBufferFromTextInput): SourceBuffer {
  const originalBytes = encodeNormalizedSource(input.text, input.encoding, input.eolByLine)
  return {
    text: input.text,
    encoding: input.encoding,
    eolByLine: [...input.eolByLine],
    originalBytesHash: input.originalBytesHash,
    originalBytes,
    originalText: input.text,
    originalEolByLine: [...input.eolByLine]
  }
}

export function rebaseSourceBuffer(
  buffer: SourceBuffer,
  originalBytes: Uint8Array,
  originalBytesHash: string
): SourceBuffer {
  return {
    ...buffer,
    originalBytes: originalBytes.slice(),
    originalBytesHash,
    originalText: buffer.text,
    originalEolByLine: [...buffer.eolByLine]
  }
}

export function applySourceChange(buffer: SourceBuffer, change: SourceChange): SourceBuffer {
  if (
    !Number.isInteger(change.from) ||
    !Number.isInteger(change.to) ||
    change.from < 0 ||
    change.to < change.from ||
    change.to > buffer.text.length
  ) {
    throw new RangeError('Source change range is outside the document')
  }

  const inserted = splitLineEndings(change.insert)
  const firstRemovedEol = countLineBreaks(buffer.text.slice(0, change.from))
  const removedEolCount = countLineBreaks(buffer.text.slice(change.from, change.to))
  const before = buffer.eolByLine.slice(0, firstRemovedEol)
  const removed = buffer.eolByLine.slice(firstRemovedEol, firstRemovedEol + removedEolCount)
  const after = buffer.eolByLine.slice(firstRemovedEol + removedEolCount)
  const insertedEols: SourceEol[] = []
  for (let index = 0; index < inserted.eolByLine.length; index += 1) {
    insertedEols.push(
      removed[index] ??
        insertedEols.at(-1) ??
        before.at(-1) ??
        after[0] ??
        dominantEol(buffer.eolByLine)
    )
  }

  return {
    ...buffer,
    text: buffer.text.slice(0, change.from) + inserted.text + buffer.text.slice(change.to),
    eolByLine: [...before, ...insertedEols, ...after]
  }
}
