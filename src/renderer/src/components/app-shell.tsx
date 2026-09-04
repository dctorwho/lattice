import type { JSX, MouseEvent, RefObject } from 'react'

import type { CommandId, CommandState } from '../../../shared/contracts'
import type { OpenedFile } from '../../../shared/contracts'
import type { CommandController } from '../commands/use-command-controller'
import type { CodeMirrorDocumentController } from '../editor/code-mirror-document-controller'
import { DocumentStatusBar } from '../editor/document-status-bar'
import { SourceEditor } from '../editor/source-editor'
import type { Locale } from '../i18n/messages'
import { translate } from '../i18n/translate'
import { AboutDialog } from './about-dialog'
import { CommandContextMenu } from './command-context-menu'

interface AppShellProps {
  readonly locale: Locale
  readonly controller: CommandController
  readonly editorController: CodeMirrorDocumentController
  readonly readOnlyDocument: Extract<OpenedFile, { readonly accessMode: 'read-only' }> | null
  readonly documentName: string
  readonly mainRef: RefObject<HTMLElement | null>
  readonly sidebarRef: RefObject<HTMLElement | null>
}

function stateFor(states: readonly CommandState[], id: CommandId): CommandState | undefined {
  return states.find((state) => state.id === id)
}

export function AppShell({
  locale,
  controller,
  editorController,
  readOnlyDocument,
  documentName,
  mainRef,
  sidebarRef
}: AppShellProps): JSX.Element {
  const toggle = stateFor(controller.commandStates, 'view.toggleSidebar')
  const about = stateFor(controller.commandStates, 'app.about')
  const createNew = stateFor(controller.commandStates, 'file.new')
  const open = stateFor(controller.commandStates, 'file.open')
  const save = stateFor(controller.commandStates, 'file.save')
  const openContextMenu = (event: MouseEvent<HTMLElement>): void => {
    event.preventDefault()
    controller.openContextMenu(event.clientX, event.clientY, event.currentTarget)
  }

  return (
    <div className="app-shell">
      <header className="title-area">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            ◈
          </span>
          <div>
            <h1>{translate(locale, 'app.brand')}</h1>
            <p>{documentName}</p>
          </div>
        </div>
        <nav className="title-actions" aria-label={translate(locale, 'app.titleActions')}>
          <button
            type="button"
            disabled={createNew?.isEnabled !== true}
            onClick={(event) => controller.execute('file.new', event.currentTarget)}
          >
            {translate(locale, 'commands.file.new')}
          </button>
          <button
            type="button"
            disabled={open?.isEnabled !== true}
            onClick={(event) => controller.execute('file.open', event.currentTarget)}
          >
            {translate(locale, 'commands.file.open')}
          </button>
          <button
            type="button"
            disabled={save?.isEnabled !== true}
            onClick={(event) => controller.execute('file.save', event.currentTarget)}
          >
            {translate(locale, 'commands.file.save')}
          </button>
          <button
            type="button"
            aria-pressed={toggle?.isChecked ?? false}
            disabled={toggle?.isEnabled !== true}
            onClick={(event) => controller.execute('view.toggleSidebar', event.currentTarget)}
          >
            {translate(locale, 'commands.view.toggleSidebar')}
          </button>
          <button
            type="button"
            disabled={about?.isEnabled !== true}
            onClick={(event) => controller.execute('app.about', event.currentTarget)}
          >
            {translate(locale, 'commands.app.about')}
          </button>
        </nav>
      </header>

      <div className="shell-body">
        {controller.isSidebarVisible && (
          <aside
            ref={sidebarRef}
            className="sidebar"
            aria-label={translate(locale, 'sidebar.label')}
            tabIndex={-1}
            onContextMenu={openContextMenu}
          >
            <h2>{translate(locale, 'sidebar.heading')}</h2>
            <p>{translate(locale, 'sidebar.empty')}</p>
          </aside>
        )}
        <main
          ref={mainRef}
          className="main-content"
          tabIndex={-1}
          aria-labelledby="main-content-title"
          onContextMenu={openContextMenu}
        >
          <div className="editor-workspace">
            <h2 id="main-content-title" className="visually-hidden">
              {translate(locale, 'main.heading')}
            </h2>
            {readOnlyDocument === null ? (
              <SourceEditor controller={editorController} />
            ) : (
              <section
                className="read-only-diagnostic"
                aria-label={translate(locale, 'readonly.label')}
              >
                <h3>{translate(locale, 'readonly.title')}</h3>
                <p>{translate(locale, 'readonly.description')}</p>
                <dl>
                  <dt>{translate(locale, 'readonly.file')}</dt>
                  <dd>{readOnlyDocument.path}</dd>
                  <dt>{translate(locale, 'readonly.hash')}</dt>
                  <dd>{readOnlyDocument.bytesHash}</dd>
                </dl>
              </section>
            )}
          </div>
        </main>
      </div>

      {readOnlyDocument === null && (
        <DocumentStatusBar locale={locale} controller={editorController} />
      )}

      {controller.contextMenu !== undefined && (
        <CommandContextMenu
          menu={controller.contextMenu}
          states={controller.commandStates}
          label={translate(locale, 'contextMenu.label')}
          toggleLabel={translate(locale, 'commands.view.toggleSidebar')}
          aboutLabel={translate(locale, 'commands.app.about')}
          onSelect={controller.selectContextCommand}
          onClose={controller.closeContextMenu}
        />
      )}
      {controller.aboutState.status !== 'closed' && (
        <AboutDialog
          state={controller.aboutState}
          locale={locale}
          onClose={controller.closeAbout}
        />
      )}
    </div>
  )
}
