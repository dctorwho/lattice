import { describe, expect, it } from 'vitest'

import {
  applyDocumentChange,
  createDocumentSession,
  decodeSourceBuffer,
  deriveDocumentStatus
} from '../../../src/domain/documents'

function sessionFor(source: string) {
  const bytes = new TextEncoder().encode(source)
  const decoded = decodeSourceBuffer(bytes, 'c'.repeat(64))
  if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
  return createDocumentSession({
    id: 'status-session',
    path: null,
    buffer: decoded.buffer,
    diskVersion: null
  })
}

describe('文档与选区状态统计（TC-M1-009）', () => {
  it('字符统计保留 Markdown 标记，词数排除格式标记且每个中文字符计一词', () => {
    const source = '- **hello world** 中文\n第二行'
    const session = sessionFor(source)

    const status = deriveDocumentStatus(session, {
      selection: { anchor: 3, head: 16 },
      readingSpeedWordsPerMinute: 200,
      zoomPercent: 100
    })

    expect(status.document).toEqual({
      characters: [...source].length,
      words: 7,
      lines: 2,
      readingMinutes: 1
    })
    expect(status.selection).toEqual({
      characters: 13,
      words: 2,
      lines: 1,
      readingMinutes: 1
    })
    expect(status.cursor).toEqual({ line: 1, column: 17 })
    expect(status.encoding).toBe('utf8')
    expect(status.eol).toBe('lf')
    expect(status.dirty).toBe(false)
    expect(status.zoomPercent).toBe(100)
  })

  it('混合换行、空选区和脏状态均从会话派生，不保存 React 镜像', () => {
    const bytes = new TextEncoder().encode('甲\r\n乙\n')
    const decoded = decodeSourceBuffer(bytes, 'd'.repeat(64))
    if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
    const clean = createDocumentSession({
      id: 'mixed-session',
      path: null,
      buffer: decoded.buffer,
      diskVersion: null
    })
    const dirty = applyDocumentChange(clean, {
      from: clean.buffer.text.length,
      to: 4,
      insert: '丙'
    })

    const status = deriveDocumentStatus(dirty, {
      selection: { anchor: 4, head: 4 },
      readingSpeedWordsPerMinute: 300,
      zoomPercent: 125
    })

    expect(status.eol).toBe('mixed')
    expect(status.selection).toBeNull()
    expect(status.dirty).toBe(true)
    expect(status.zoomPercent).toBe(125)
  })
})
