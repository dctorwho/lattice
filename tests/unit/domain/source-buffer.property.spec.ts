import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  applySourceChange,
  decodeSourceBuffer,
  encodeSourceBuffer,
  type SourceEncoding
} from '../../../src/domain/documents'

const SHA_256_FIXTURE = 'a'.repeat(64)

function encodeFixture(text: string, encoding: SourceEncoding): Uint8Array {
  if (encoding === 'utf8' || encoding === 'utf8-bom') {
    const payload = new TextEncoder().encode(text)
    if (encoding === 'utf8') return payload
    return Uint8Array.from([0xef, 0xbb, 0xbf, ...payload])
  }

  const bytes: number[] = encoding === 'utf16le' ? [0xff, 0xfe] : [0xfe, 0xff]
  for (let index = 0; index < text.length; index += 1) {
    const codeUnit = text.charCodeAt(index)
    if (encoding === 'utf16le') {
      bytes.push(codeUnit & 0xff, codeUnit >>> 8)
    } else {
      bytes.push(codeUnit >>> 8, codeUnit & 0xff)
    }
  }
  return Uint8Array.from(bytes)
}

describe('SourceBuffer 编码与换行往返（TC-M1-001）', () => {
  it.each([
    { encoding: 'utf8' as const, source: '' },
    { encoding: 'utf8' as const, source: '标题\n正文' },
    { encoding: 'utf8-bom' as const, source: '标题\r\n正文\r\n' },
    { encoding: 'utf16le' as const, source: 'A\r\n中文\n😀' },
    { encoding: 'utf16be' as const, source: 'e\u0301\n末行' }
  ])('未编辑的 $encoding 字节完全不变', ({ encoding, source }) => {
    const bytes = encodeFixture(source, encoding)
    const decoded = decodeSourceBuffer(bytes, SHA_256_FIXTURE)

    expect(decoded.status).toBe('editable')
    if (decoded.status !== 'editable') return

    expect(decoded.buffer.encoding).toBe(encoding)
    expect(decoded.buffer.originalBytesHash).toBe(SHA_256_FIXTURE)
    expect(encodeSourceBuffer(decoded.buffer)).toEqual(bytes)
  })

  it('严格拒绝非法 UTF-8，并保留只读诊断所需的原始字节', () => {
    const bytes = Uint8Array.from([0x66, 0x6f, 0x80, 0x6f])

    expect(decodeSourceBuffer(bytes, SHA_256_FIXTURE)).toEqual({
      status: 'read-only',
      reason: 'unsupported-encoding',
      originalBytes: bytes,
      originalBytesHash: SHA_256_FIXTURE
    })
  })

  it.each([
    Uint8Array.from([0xff, 0xfe, 0x00, 0x00, 0x41, 0x00, 0x00, 0x00]),
    Uint8Array.from([0x00, 0x00, 0xfe, 0xff, 0x00, 0x00, 0x00, 0x41])
  ])('不把 UTF-32 BOM 误识别成受支持的 UTF-16', (bytes) => {
    expect(decodeSourceBuffer(bytes, SHA_256_FIXTURE).status).toBe('read-only')
  })

  it('把编辑文本规范为 LF，同时逐个保留原始行结束符', () => {
    const decoded = decodeSourceBuffer(
      encodeFixture('第一行\r\n第二行\n第三行\r\n', 'utf8'),
      SHA_256_FIXTURE
    )

    expect(decoded.status).toBe('editable')
    if (decoded.status !== 'editable') return

    expect(decoded.buffer.text).toBe('第一行\n第二行\n第三行\n')
    expect(decoded.buffer.eolByLine).toEqual(['\r\n', '\n', '\r\n'])
  })

  it('新插入的换行优先继承前一个相邻换行', () => {
    const decoded = decodeSourceBuffer(
      encodeFixture('第一行\r\n第二行\n第三行', 'utf8'),
      SHA_256_FIXTURE
    )

    expect(decoded.status).toBe('editable')
    if (decoded.status !== 'editable') return

    const insertionPoint = decoded.buffer.text.indexOf('第三行')
    const changed = applySourceChange(decoded.buffer, {
      from: insertionPoint,
      to: insertionPoint,
      insert: '新增行\n'
    })

    expect(changed.text).toBe('第一行\n第二行\n新增行\n第三行')
    expect(changed.eolByLine).toEqual(['\r\n', '\n', '\n'])
    expect(new TextDecoder().decode(encodeSourceBuffer(changed))).toBe(
      '第一行\r\n第二行\n新增行\n第三行'
    )
  })

  it('替换范围内先复用原换行，额外换行再继承刚复用的相邻换行', () => {
    const decoded = decodeSourceBuffer(
      encodeFixture('第一行\n第二行\r\n第三行', 'utf8'),
      SHA_256_FIXTURE
    )

    expect(decoded.status).toBe('editable')
    if (decoded.status !== 'editable') return

    const secondEol = decoded.buffer.text.lastIndexOf('\n')
    const changed = applySourceChange(decoded.buffer, {
      from: secondEol,
      to: secondEol + 1,
      insert: '\n\n'
    })

    expect(changed.eolByLine).toEqual(['\n', '\r\n', '\r\n'])
  })

  it.each<SourceEncoding>(['utf8', 'utf8-bom', 'utf16le', 'utf16be'])(
    '%s 单字符修改只改变对应的字节区间并保留 BOM、换行和尾部',
    (encoding) => {
      const original = encodeFixture('标题\r\nalpha\n末行\r\n', encoding)
      const decoded = decodeSourceBuffer(original, SHA_256_FIXTURE)

      expect(decoded.status).toBe('editable')
      if (decoded.status !== 'editable') return

      const from = decoded.buffer.text.indexOf('alpha') + 2
      const changed = applySourceChange(decoded.buffer, { from, to: from + 1, insert: 'Z' })
      const saved = encodeSourceBuffer(changed)

      const expected = encodeFixture('标题\r\nalZha\n末行\r\n', encoding)
      expect(saved).toEqual(expected)
      expect(saved.slice(0, encoding === 'utf8' ? 0 : encoding === 'utf8-bom' ? 3 : 2)).toEqual(
        original.slice(0, encoding === 'utf8' ? 0 : encoding === 'utf8-bom' ? 3 : 2)
      )
    }
  )

  it('对受支持字符、编码和换行组合执行确定性性质往返', () => {
    const segment = fc.array(fc.constantFrom('a', 'Z', '中', '文', '😀', 'e\u0301', '\0'), {
      maxLength: 12
    })
    const source = fc
      .tuple(
        fc.array(segment, { minLength: 1, maxLength: 8 }),
        fc.array(fc.constantFrom('\n' as const, '\r\n' as const), { maxLength: 7 }),
        fc.constantFrom<SourceEncoding>('utf8', 'utf8-bom', 'utf16le', 'utf16be')
      )
      .filter(([lines, eols]) => eols.length === lines.length - 1)

    fc.assert(
      fc.property(source, ([lines, eols, encoding]) => {
        let text = `x${lines[0]?.join('') ?? ''}`
        for (let index = 0; index < eols.length; index += 1) {
          text += `${eols[index]}${lines[index + 1]?.join('') ?? ''}`
        }
        const bytes = encodeFixture(text, encoding)
        const decoded = decodeSourceBuffer(bytes, SHA_256_FIXTURE)

        expect(decoded.status).toBe('editable')
        if (decoded.status !== 'editable') return
        expect(encodeSourceBuffer(decoded.buffer)).toEqual(bytes)
      }),
      { numRuns: 100, seed: 13_808 }
    )
  })
})
