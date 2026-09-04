import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  applyDocumentChange,
  createDocumentSession,
  decodeSourceBuffer,
  isDocumentSessionDirty,
  markDocumentSaved,
  redoDocumentChange,
  setDocumentPath,
  undoDocumentChange,
  type DocumentSession,
  type SourceBuffer
} from '../../../src/domain/documents'

const HASH = 'b'.repeat(64)

function source(text = 'abc'): SourceBuffer {
  const decoded = decodeSourceBuffer(new TextEncoder().encode(text), HASH)
  if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
  return decoded.buffer
}

function session(): DocumentSession {
  return createDocumentSession({
    id: 'session-1',
    path: 'D:\\docs\\note.md',
    buffer: source(),
    diskVersion: { mtimeMs: 1, size: 3, contentHash: HASH }
  })
}

describe('DocumentSession 修订与历史（TC-M1-004）', () => {
  it('撤销到已保存内容时清除脏状态，但单调 revision 不回退', () => {
    const edited = applyDocumentChange(session(), { from: 3, to: 3, insert: '1' })
    const saved = markDocumentSaved(edited, {
      diskVersion: { mtimeMs: 2, size: 4, contentHash: 'c'.repeat(64) }
    })
    const editedAgain = applyDocumentChange(saved, { from: 4, to: 4, insert: '2' })
    const undone = undoDocumentChange(editedAgain)

    expect(undone.revision).toBeGreaterThan(editedAgain.revision)
    expect(undone.currentContentRevision).toBe(saved.savedRevision)
    expect(undone.buffer.text).toBe('abc1')
    expect(isDocumentSessionDirty(undone)).toBe(false)
  })

  it('撤销后产生新编辑会丢弃 redo 分支，并保持各快照不可变', () => {
    const original = session()
    const first = applyDocumentChange(original, { from: 3, to: 3, insert: '1' })
    const second = applyDocumentChange(first, { from: 4, to: 4, insert: '2' })
    const undone = undoDocumentChange(second)
    const branched = applyDocumentChange(undone, { from: 4, to: 4, insert: 'X' })

    expect(original.buffer.text).toBe('abc')
    expect(second.buffer.text).toBe('abc12')
    expect(branched.buffer.text).toBe('abc1X')
    expect(redoDocumentChange(branched)).toBe(branched)
  })

  it('路径变化不伪造正文修改或清空历史', () => {
    const edited = applyDocumentChange(session(), { from: 0, to: 1, insert: 'A' })
    const moved = setDocumentPath(edited, 'D:\\docs\\renamed.markdown')

    expect(moved.path).toBe('D:\\docs\\renamed.markdown')
    expect(moved.revision).toBe(edited.revision)
    expect(isDocumentSessionDirty(moved)).toBe(true)
    expect(undoDocumentChange(moved).buffer.text).toBe('abc')
  })

  it('固定 100 个种子执行合计至少 10,000 次编辑、撤销、重做和保存状态转换', () => {
    const operation = fc.constantFrom('append', 'delete', 'undo', 'redo', 'save', 'rename')

    fc.assert(
      fc.property(fc.array(operation, { minLength: 100, maxLength: 100 }), (operations) => {
        let current = session()
        let previousRevision = current.revision

        for (const [index, operationName] of operations.entries()) {
          if (operationName === 'append') {
            current = applyDocumentChange(current, {
              from: current.buffer.text.length,
              to: current.buffer.text.length,
              insert: String(index % 10)
            })
          } else if (operationName === 'delete' && current.buffer.text.length > 0) {
            current = applyDocumentChange(current, {
              from: current.buffer.text.length - 1,
              to: current.buffer.text.length,
              insert: ''
            })
          } else if (operationName === 'undo') {
            current = undoDocumentChange(current)
          } else if (operationName === 'redo') {
            current = redoDocumentChange(current)
          } else if (operationName === 'save') {
            current = markDocumentSaved(current, {
              diskVersion: {
                mtimeMs: index + 2,
                size: current.buffer.text.length,
                contentHash: String(index).padStart(64, '0')
              }
            })
          } else if (operationName === 'rename') {
            current = setDocumentPath(current, `D:\\docs\\${index}.md`)
          }

          expect(current.revision).toBeGreaterThanOrEqual(previousRevision)
          expect(isDocumentSessionDirty(current)).toBe(
            current.currentContentRevision !== current.savedRevision
          )
          previousRevision = current.revision
        }
      }),
      { numRuns: 100, seed: 13_804 }
    )
  })
})
