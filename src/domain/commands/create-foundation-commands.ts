import type { AppCommand, CommandState } from './command-types'

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
  return [
    {
      id: 'view.toggleSidebar',
      labelKey: 'commands.view.toggleSidebar',
      defaultShortcut: 'CommandOrControl+Shift+L',
      getState: (context) =>
        sidebarState(context.isSidebarVisible, context.isWindowFocused, context.isDialogOpen),
      run: (context) => {
        context.toggleSidebar()
        return Promise.resolve({ status: 'executed' })
      }
    },
    {
      id: 'app.about',
      labelKey: 'commands.app.about',
      defaultShortcut: 'F1',
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
