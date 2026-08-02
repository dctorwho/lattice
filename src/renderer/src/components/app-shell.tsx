import type { JSX, MouseEvent, RefObject } from 'react'

import type { CommandId, CommandState } from '../../../shared/contracts'
import type { CommandController } from '../commands/use-command-controller'
import type { Locale } from '../i18n/messages'
import { translate } from '../i18n/translate'
import { AboutDialog } from './about-dialog'
import { CommandContextMenu } from './command-context-menu'

interface AppShellProps {
  readonly locale: Locale
  readonly controller: CommandController
  readonly mainRef: RefObject<HTMLElement | null>
  readonly sidebarRef: RefObject<HTMLElement | null>
}

function stateFor(states: readonly CommandState[], id: CommandId): CommandState | undefined {
  return states.find((state) => state.id === id)
}

export function AppShell({ locale, controller, mainRef, sidebarRef }: AppShellProps): JSX.Element {
  const toggle = stateFor(controller.commandStates, 'view.toggleSidebar')
  const about = stateFor(controller.commandStates, 'app.about')
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
            <p>{translate(locale, 'app.foundationReady')}</p>
          </div>
        </div>
        <nav className="title-actions" aria-label={translate(locale, 'app.titleActions')}>
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
          <div className="editor-empty-state">
            <span aria-hidden="true">#</span>
            <h2 id="main-content-title">{translate(locale, 'main.heading')}</h2>
            <p>{translate(locale, 'main.pending')}</p>
          </div>
        </main>
      </div>

      <footer className="status-bar" role="status" aria-live="polite">
        {translate(locale, controller.statusKey)}
      </footer>

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
