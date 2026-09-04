import { act, render } from '@testing-library/react'
import { Transaction } from '@codemirror/state'
import { describe, expect, it } from 'vitest'

import { createDocumentSession, decodeSourceBuffer } from '../../../src/domain/documents'
import { CodeMirrorDocumentController } from '../../../src/renderer/src/editor/code-mirror-document-controller'
import { SourceEditor } from '../../../src/renderer/src/editor/source-editor'

function createController(id: string, text: string): CodeMirrorDocumentController {
  const bytes = new TextEncoder().encode(text)
  const decoded = decodeSourceBuffer(bytes, 'a'.repeat(64))
  if (decoded.status !== 'editable') throw new Error('测试夹具必须可编辑')
  return new CodeMirrorDocumentController(
    createDocumentSession({ id, path: null, buffer: decoded.buffer, diskVersion: null })
  )
}

describe('CodeMirror 源码编辑（TC-M1-006）', () => {
  it('在 React 外保存全文、选区和历史，并在卸载重挂后继续撤销重做', () => {
    const controller = createController('session-a', '标题\n正文')
    const rendered = render(<SourceEditor controller={controller} />)

    expect(rendered.container.querySelector('.cm-editor')).not.toBeNull()
    act(() => {
      controller.dispatch({
        changes: { from: 3, to: 5, insert: '中文😀\n第二段' },
        selection: { anchor: 6 }
      })
    })

    expect(controller.state.doc.toString()).toBe('标题\n中文😀\n第二段')
    expect(controller.session.buffer.text).toBe('标题\n中文😀\n第二段')
    expect(controller.state.selection.main.anchor).toBe(6)
    rendered.unmount()

    const remounted = render(<SourceEditor controller={controller} />)
    expect(controller.state.selection.main.anchor).toBe(6)
    act(() => {
      expect(controller.undo()).toBe(true)
    })
    expect(controller.state.doc.toString()).toBe('标题\n正文')
    expect(controller.session.buffer.text).toBe('标题\n正文')
    act(() => {
      expect(controller.redo()).toBe(true)
    })
    expect(controller.state.doc.toString()).toBe('标题\n中文😀\n第二段')
    expect(remounted.container.querySelector('.cm-editor')).not.toBeNull()
  })

  it('两个控制器的文本、选区与历史完全隔离', () => {
    const first = createController('session-a', '甲')
    const second = createController('session-b', '乙')
    const firstView = render(<SourceEditor controller={first} />)
    const secondView = render(<SourceEditor controller={second} />)

    act(() => {
      first.dispatch({ changes: { from: 1, insert: '一' }, selection: { anchor: 2 } })
    })

    expect(first.session.buffer.text).toBe('甲一')
    expect(first.state.selection.main.anchor).toBe(2)
    expect(second.session.buffer.text).toBe('乙')
    expect(second.state.selection.main.anchor).toBe(0)
    expect(firstView.container.querySelector('.cm-editor')).not.toBeNull()
    expect(secondView.container.querySelector('.cm-editor')).not.toBeNull()
  })

  it('全部正则替换作为一个事务提交，并可用一次撤销恢复捕获组来源', () => {
    const controller = createController('session-replace', 'alpha-one beta-two')
    render(<SourceEditor controller={controller} />)

    act(() => {
      const result = controller.replaceAll(
        {
          pattern: '(\\w+)-(\\w+)',
          useRegex: true,
          caseSensitive: true,
          wholeWord: false
        },
        '$2:$1'
      )
      expect(result).toEqual({ status: 'replaced', count: 2 })
    })

    expect(controller.session.buffer.text).toBe('one:alpha two:beta')
    act(() => {
      expect(controller.undo()).toBe(true)
    })
    expect(controller.session.buffer.text).toBe('alpha-one beta-two')
  })

  it('组合输入的多次更新按 CodeMirror 历史分组一次撤销和重做', () => {
    const controller = createController('session-composition', '')
    render(<SourceEditor controller={controller} />)

    act(() => {
      controller.dispatch({
        changes: { from: 0, insert: '中' },
        annotations: Transaction.userEvent.of('input.type.compose')
      })
      controller.dispatch({
        changes: { from: 0, to: 1, insert: '中文' },
        annotations: Transaction.userEvent.of('input.type.compose')
      })
      controller.dispatch({
        changes: { from: 0, to: 2, insert: '中文，😀e\u0301' },
        annotations: Transaction.userEvent.of('input.type')
      })
    })

    expect(controller.session.buffer.text).toBe('中文，😀é')
    act(() => {
      expect(controller.undo()).toBe(true)
    })
    expect(controller.state.doc.toString()).toBe('')
    expect(controller.session.buffer.text).toBe('')
    act(() => {
      expect(controller.redo()).toBe(true)
    })
    expect(controller.session.buffer.text).toBe('中文，😀é')
  })

  it('生成严格保存快照，并只在匹配当前修订的成功响应后清除脏状态', () => {
    const controller = createController('00000000-0000-4000-8000-000000000701', '原文')
    controller.dispatch({ changes: { from: 2, insert: '\n修改' } })
    const createSaveSnapshot = Reflect.get(controller, 'createSaveSnapshot')
    const acceptSavedFile = Reflect.get(controller, 'acceptSavedFile')

    expect(typeof createSaveSnapshot).toBe('function')
    expect(typeof acceptSavedFile).toBe('function')
    if (typeof createSaveSnapshot !== 'function' || typeof acceptSavedFile !== 'function') return
    expect(Reflect.apply(createSaveSnapshot, controller, [])).toEqual({
      documentId: '00000000-0000-4000-8000-000000000701',
      revision: 1,
      text: '原文\n修改',
      encoding: 'utf8',
      eolByLine: ['\n']
    })

    const saved = {
      path: 'D:\\文档\\已保存.md',
      revision: 1,
      diskVersion: { mtimeMs: 2, size: 13, contentHash: 'b'.repeat(64) },
      bytesHash: 'b'.repeat(64)
    }
    expect(Reflect.apply(acceptSavedFile, controller, [saved])).toBe(true)
    expect(controller.session.path).toBe(saved.path)
    expect(controller.session.savedRevision).toBe(1)
    expect(controller.session.buffer.originalBytesHash).toBe(saved.bytesHash)

    controller.dispatch({ changes: { from: controller.state.doc.length, insert: '新' } })
    expect(Reflect.apply(acceptSavedFile, controller, [saved])).toBe(false)
    expect(controller.session.savedRevision).toBe(1)
  })
})
