import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../../src/renderer/src/app'
import { createUntitledDocumentSession } from '../../src/domain/documents'
import { CodeMirrorDocumentController } from '../../src/renderer/src/editor/code-mirror-document-controller'

const openedDocument = {
  accessMode: 'editable' as const,
  documentId: '00000000-0000-4000-8000-000000000801',
  path: 'D:\\文档\\打开.md',
  text: '打开的正文',
  encoding: 'utf8' as const,
  eolByLine: [],
  bytesHash: '6'.repeat(64),
  diskVersion: { mtimeMs: 1, size: 15, contentHash: '6'.repeat(64) }
}
const openFile = vi.fn(() => Promise.resolve({ ok: true as const, value: openedDocument }))
const saveFile = vi.fn(() =>
  Promise.resolve({
    ok: true as const,
    value: {
      status: 'saved' as const,
      file: {
        path: openedDocument.path,
        revision: 0,
        diskVersion: openedDocument.diskVersion,
        bytesHash: openedDocument.bytesHash
      }
    }
  })
)
const saveAsFile = vi.fn(() => Promise.resolve({ ok: true as const, value: null }))

describe('M1 renderer source editor smoke', () => {
  beforeEach(() => {
    openFile.mockClear()
    saveFile.mockClear()
    saveAsFile.mockClear()
    Object.defineProperty(window, 'lattice', {
      configurable: true,
      value: Object.freeze({
        app: Object.freeze({
          onCloseRequested: () => () => {},
          confirmClose: () =>
            Promise.resolve({ ok: true as const, value: { applied: true as const } }),
          getInfo: () =>
            Promise.resolve({
              ok: true,
              value: {
                contractVersion: 1,
                name: 'Lattice',
                version: '0.0.0',
                platform: 'win32'
              }
            })
        }),
        commands: Object.freeze({
          onInvoke: () => () => {},
          updateStates: () =>
            Promise.resolve({ ok: true, value: { contractVersion: 1, applied: true } })
        }),
        files: Object.freeze({
          open: openFile,
          save: saveFile,
          saveAs: saveAsFile,
          confirmedOverwrite: saveFile,
          reloadExternal: () =>
            Promise.resolve({
              ok: false as const,
              error: {
                code: 'INTERNAL_UNEXPECTED' as const,
                messageKey: 'errors.internal.unexpected' as const,
                retryable: false
              }
            }),
          onExternalChange: () => () => {}
        }),
        recovery: Object.freeze({
          write: () => Promise.resolve({ ok: true as const, value: { applied: true as const } }),
          list: () => Promise.resolve({ ok: true as const, value: [] }),
          discard: () => Promise.resolve({ ok: true as const, value: { applied: true as const } })
        })
      })
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'lattice')
  })

  it('renders the accessible source editor inside the desktop shell', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Lattice' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('0 词')
    expect(screen.getByRole('status')).toHaveTextContent('UTF-8')
    expect(screen.getByRole('status')).toHaveTextContent('100%')
    expect(screen.getByRole('complementary', { name: '侧栏' })).toBeVisible()
    expect(screen.getByRole('main')).toBeVisible()
    expect(screen.getByRole('status')).toBeVisible()
    expect(screen.getByRole('textbox')).toBeVisible()
    expect(screen.getByRole('button', { name: '打开…' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled()
  })

  it('通过统一文档命令打开并保存主进程授权的文档', async () => {
    const rendered = render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '打开…' }))
    await waitFor(() => expect(openFile).toHaveBeenCalledOnce())
    await waitFor(() =>
      expect(rendered.container.querySelector('.cm-content')).toHaveTextContent('打开的正文')
    )
    expect(screen.getByText('打开.md')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(saveFile).toHaveBeenCalledOnce())
    expect(saveFile).toHaveBeenCalledWith({
      documentId: openedDocument.documentId,
      path: openedDocument.path,
      revision: 0,
      text: openedDocument.text,
      encoding: openedDocument.encoding,
      eolByLine: openedDocument.eolByLine,
      expectedDiskVersion: openedDocument.diskVersion
    })
  })

  it('未保存文档在新建前提供保存、不保存和取消门禁，取消后原文保持不变', async () => {
    const dirtyController = new CodeMirrorDocumentController(
      createUntitledDocumentSession('00000000-0000-4000-8000-000000000802')
    )
    dirtyController.dispatch({ changes: { from: 0, insert: '不能静默丢失的正文' } })
    const rendered = render(<App initialEditorController={dirtyController} />)

    fireEvent.click(screen.getByRole('button', { name: '新建' }))

    const dialog = await screen.findByRole('dialog', { name: '保存更改' })
    expect(dialog).toHaveTextContent('未命名')
    expect(within(dialog).getByRole('button', { name: '保存' })).toBeVisible()
    expect(within(dialog).getByRole('button', { name: '不保存' })).toBeVisible()
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(rendered.container.querySelector('.cm-content')).toHaveTextContent('不能静默丢失的正文')
  })

  it('未保存文档选择保存但另存为取消时，不执行新建', async () => {
    const dirtyController = new CodeMirrorDocumentController(
      createUntitledDocumentSession('00000000-0000-4000-8000-000000000803')
    )
    dirtyController.dispatch({ changes: { from: 0, insert: '仍需保留' } })
    const rendered = render(<App initialEditorController={dirtyController} />)

    fireEvent.click(screen.getByRole('button', { name: '新建' }))
    const dialog = await screen.findByRole('dialog', { name: '保存更改' })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))

    await waitFor(() => expect(saveAsFile).toHaveBeenCalledOnce())
    expect(screen.getByRole('dialog', { name: '保存更改' })).toBeVisible()
    expect(rendered.container.querySelector('.cm-content')).toHaveTextContent('仍需保留')
  })

  it('统一查找与替换命令提供真实结果，并把全部替换作为一次可撤销事务', async () => {
    const controller = new CodeMirrorDocumentController(
      createUntitledDocumentSession('00000000-0000-4000-8000-000000000804')
    )
    controller.dispatch({ changes: { from: 0, insert: 'alpha alpha' } })
    render(<App initialEditorController={controller} />)

    fireEvent.keyDown(window, { key: 'h', ctrlKey: true })
    const panel = await screen.findByRole('region', { name: '替换' })
    fireEvent.change(within(panel).getByLabelText('查找'), { target: { value: 'alpha' } })
    fireEvent.change(within(panel).getByLabelText('替换为'), { target: { value: 'beta' } })
    expect(within(panel).getByText('2 个匹配项')).toBeVisible()
    fireEvent.click(within(panel).getByRole('button', { name: '全部替换' }))

    expect(controller.session.buffer.text).toBe('beta beta')
    expect(controller.undo()).toBe(true)
    expect(controller.session.buffer.text).toBe('alpha alpha')
  })
})
