import type { AppCommand, CommandState } from './command-types'
import { foundationCommandMetadata } from '../../shared/commands'

function sidebarState(
  isSidebarVisible: boolean,
  isWindowFocused: boolean,
  isDialogOpen: boolean
): CommandState {
  return {
    id: 'view.toggleSidebar',
    isVisible: true,
    isEnabled: isWindowFocused && !isDialogOpen,
    isChecked: isSidebarVisible
  }
}

export function createFoundationCommands(): readonly AppCommand[] {
  const toggleMetadata = foundationCommandMetadata['view.toggleSidebar']
  const aboutMetadata = foundationCommandMetadata['app.about']
  return [
    {
      id: toggleMetadata.id,
      labelKey: toggleMetadata.labelKey,
      defaultShortcut: toggleMetadata.defaultShortcut,
      getState: (context) =>
        sidebarState(context.isSidebarVisible, context.isWindowFocused, context.isDialogOpen),
      run: (context) => {
        context.toggleSidebar()
        return Promise.resolve({ status: 'executed' })
      }
    },
    {
      id: aboutMetadata.id,
      labelKey: aboutMetadata.labelKey,
      defaultShortcut: aboutMetadata.defaultShortcut,
      getState: (context) => ({
        id: 'app.about',
        isVisible: true,
        isEnabled: !context.isDialogOpen,
        isChecked: false
      }),
      run: async (context) => {
        await context.openAbout()
        return { status: 'executed' }
      }
    }
  ]
}
