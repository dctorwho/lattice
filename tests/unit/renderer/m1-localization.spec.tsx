import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { createUntitledDocumentSession } from '../../../src/domain/documents'
import { ExternalConflictDialog } from '../../../src/renderer/src/components/external-conflict-dialog'
import { UnsavedChangesDialog } from '../../../src/renderer/src/components/unsaved-changes-dialog'
import { CodeMirrorDocumentController } from '../../../src/renderer/src/editor/code-mirror-document-controller'
import { DocumentStatusBar } from '../../../src/renderer/src/editor/document-status-bar'
import { FindReplacePanel } from '../../../src/renderer/src/editor/find-replace-panel'

describe('M1 renderer localization', () => {
  it('renders document lifecycle dialogs from the English catalog', () => {
    const { rerender } = render(
      <UnsavedChangesDialog
        locale="en"
        documentName="draft.md"
        isSaving={false}
        onSave={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog', { name: 'Save changes' })).toHaveTextContent(
      'Save changes to “draft.md”?'
    )

    rerender(
      <ExternalConflictDialog
        locale="en"
        conflict={{
          status: 'conflict',
          conflictToken: '00000000-0000-4000-8000-000000000901',
          external: {
            accessMode: 'editable',
            text: 'disk',
            encoding: 'utf8',
            eolByLine: [],
            bytesHash: 'a'.repeat(64),
            diskVersion: { mtimeMs: 1, size: 4, contentHash: 'a'.repeat(64) }
          }
        }}
        localText="local"
        onReload={vi.fn()}
        onSaveAs={vi.fn()}
        onOverwrite={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByRole('dialog', { name: 'File changed outside the app' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Compare versions' })).toBeVisible()
  })

  it('localizes search and document status, including visible large-file degradation', () => {
    const controller = new CodeMirrorDocumentController(
      createUntitledDocumentSession('00000000-0000-4000-8000-000000000903')
    )
    controller.dispatch({ changes: { from: 0, insert: 'alpha alpha' } })
    const { rerender } = render(
      <FindReplacePanel locale="en" mode="find" controller={controller} onClose={vi.fn()} />
    )

    expect(screen.getByRole('region', { name: 'Find' })).toBeVisible()
    expect(screen.getByText('0 matches')).toBeVisible()

    fireEvent.change(screen.getByRole('textbox', { name: 'Find' }), {
      target: { value: 'alpha' }
    })
    const panel = screen.getByRole('region', { name: 'Find' })
    fireEvent.click(within(panel).getByRole('button', { name: 'Next match' }))
    expect(controller.state.selection.main).toMatchObject({ from: 0, to: 5 })

    rerender(<DocumentStatusBar locale="en" controller={controller} />)
    expect(screen.getByRole('status')).toHaveTextContent('2 words')
    expect(screen.getByRole('status')).toHaveTextContent('Selected 1 words')
    expect(screen.getByRole('status')).toHaveTextContent('1 min read')

    const largeController = new CodeMirrorDocumentController({
      ...createUntitledDocumentSession('00000000-0000-4000-8000-000000000904'),
      diskVersion: {
        mtimeMs: 1,
        size: 5 * 1024 * 1024,
        contentHash: 'a'.repeat(64)
      }
    })
    rerender(<DocumentStatusBar locale="en" controller={largeController} />)

    expect(screen.getByRole('status')).toHaveTextContent('Large-file source mode')
  })
})
