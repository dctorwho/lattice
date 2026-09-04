import { describe, expect, it } from 'vitest'

import { findDocumentMatches } from '../../../src/domain/documents'

describe('文档查找语义（TC-M1-009）', () => {
  it('支持大小写、Unicode 全词和跨行匹配', () => {
    const source = 'foo FOO food\n中文 中文词\n跨\n行'

    expect(
      findDocumentMatches(source, {
        pattern: 'foo',
        useRegex: false,
        caseSensitive: false,
        wholeWord: true
      })
    ).toMatchObject({
      status: 'matched',
      matches: [
        { from: 0, to: 3 },
        { from: 4, to: 7 }
      ]
    })
    expect(
      findDocumentMatches(source, {
        pattern: '中文',
        useRegex: false,
        caseSensitive: true,
        wholeWord: true
      })
    ).toMatchObject({ status: 'matched', matches: [{ from: 13, to: 15 }] })
    expect(
      findDocumentMatches(source, {
        pattern: '跨\\n行',
        useRegex: true,
        caseSensitive: true,
        wholeWord: false
      })
    ).toMatchObject({ status: 'matched', matches: [{ from: 20, to: 23 }] })
  })

  it('零宽正则在每个位置至多返回一次，非法正则返回稳定错误且不修改来源', () => {
    const source = '甲\n乙'

    const zeroWidth = findDocumentMatches(source, {
      pattern: '^|$',
      useRegex: true,
      caseSensitive: true,
      wholeWord: false
    })
    const invalid = findDocumentMatches(source, {
      pattern: '[',
      useRegex: true,
      caseSensitive: true,
      wholeWord: false
    })

    expect(zeroWidth).toMatchObject({
      status: 'matched',
      matches: [
        { from: 0, to: 0 },
        { from: 1, to: 1 },
        { from: 2, to: 2 },
        { from: 3, to: 3 }
      ]
    })
    expect(invalid).toEqual({ status: 'invalid-pattern', code: 'SEARCH_INVALID_PATTERN' })
    expect(source).toBe('甲\n乙')
  })
})
