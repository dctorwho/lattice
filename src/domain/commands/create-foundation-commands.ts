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

function normalState(
  id: CommandState['id'],
  context: { readonly isWindowFocused: boolean; readonly isDialogOpen: boolean },
  available = true
): CommandState {
  return {
    id,
    isVisible: true,
    isEnabled: context.isWindowFocused && !context.isDialogOpen && available,
    isChecked: false
  }
}

function executable(
  id: keyof typeof foundationCommandMetadata,
  getState: AppCommand['getState'],
  run: (context: Parameters<AppCommand['run']>[0]) => void | Promise<void>
): AppCommand {
  const metadata = foundationCommandMetadata[id]
  return {
    id: metadata.id,
    labelKey: metadata.labelKey,
    defaultShortcut: metadata.defaultShortcut,
    getState,
    run: async (context) => {
      await run(context)
      return { status: 'executed' }
    }
  }
}

export function createFoundationCommands(): readonly AppCommand[] {
  const toggleMetadata = foundationCommandMetadata['view.toggleSidebar']
  const aboutMetadata = foundationCommandMetadata['app.about']
  return [
    executable(
      'file.new',
      (context) => normalState('file.new', context),
      (context) => context.newDocument()
    ),
    executable(
      'file.open',
      (context) => normalState('file.open', context),
      (context) => context.openDocument()
    ),
    executable(
      'file.save',
      (context) =>
        normalState(
          'file.save',
          context,
          context.hasSession && context.hasEditor && !context.isSessionReadOnly
        ),
      (context) => context.saveDocument()
    ),
    executable(
      'file.saveAs',
      (context) => normalState('file.saveAs', context, context.hasSession && context.hasEditor),
      (context) => context.saveDocumentAs()
    ),
    executable(
      'file.close',
      (context) => normalState('file.close', context, context.hasSession),
      (context) => context.closeDocument()
    ),
    executable(
      'edit.undo',
      (context) => normalState('edit.undo', context, context.hasEditor && context.canUndo),
      (context) => context.undo()
    ),
    executable(
      'edit.redo',
      (context) => normalState('edit.redo', context, context.hasEditor && context.canRedo),
      (context) => context.redo()
    ),
    executable(
      'edit.find',
      (context) => normalState('edit.find', context, context.hasEditor),
      (context) => context.openFind()
    ),
    executable(
      'edit.replace',
      (context) => normalState('edit.replace', context, context.hasEditor),
      (context) => context.openReplace()
    ),
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
