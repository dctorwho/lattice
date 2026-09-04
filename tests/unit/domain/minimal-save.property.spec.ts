import { describe, expect, it } from 'vitest'

import {
  applySourceChange,
  createSourceBufferFromText,
  encodeSourceBuffer,
  type SourceEncoding,
  type SourceEol
} from '../../../src/domain/documents'

const encodings: readonly SourceEncoding[] = ['utf8', 'utf8-bom', 'utf16le', 'utf16be']
const eolPatterns: readonly (readonly SourceEol[])[] = [
  ['\n', '\n'],
  ['\r\n', '\r\n'],
  ['\r\n', '\n']
]

describe('最小源码补丁保存（TC-M1-011）', () => {
  it.each(
    encodings.flatMap((encoding) => eolPatterns.map((eolByLine) => ({ encoding, eolByLine })))
  )(
    '$encoding / $eolByLine 只改变目标字符对应的一个字节，其余字节与 BOM 保持不变',
    ({ encoding, eolByLine }) => {
      const original = createSourceBufferFromText({
        text: '前缀\nA middle\n末尾😀',
        encoding,
        eolByLine,
        originalBytesHash: 'a'.repeat(64)
      })
      const originalBytes = encodeSourceBuffer(original)
      const offset = original.text.indexOf('A')
      const changed = applySourceChange(original, { from: offset, to: offset + 1, insert: 'B' })
      const changedBytes = encodeSourceBuffer(changed)
      const differingIndices = [...originalBytes.keys()].filter(
        (index) => originalBytes[index] !== changedBytes[index]
      )

      expect(changedBytes).toHaveLength(originalBytes.length)
      expect(differingIndices).toHaveLength(1)
      expect(changed.text).toBe('前缀\nB middle\n末尾😀')
      expect(changed.eolByLine).toEqual(eolByLine)
      expect(
        changedBytes.slice(0, encoding === 'utf8-bom' ? 3 : encoding === 'utf8' ? 0 : 2)
      ).toEqual(originalBytes.slice(0, encoding === 'utf8-bom' ? 3 : encoding === 'utf8' ? 0 : 2))
    }
  )
})
