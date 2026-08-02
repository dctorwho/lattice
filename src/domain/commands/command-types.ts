import type { CommandId, CommandState } from '../../shared/contracts/command'

export type { CommandId, CommandState }

export type CommandLabelKey = 'commands.app.about' | 'commands.view.toggleSidebar'

export interface CommandContext {
  readonly isSidebarVisible: boolean
  readonly isDialogOpen: boolean
  readonly isWindowFocused: boolean
  readonly hasSession: boolean
  readonly isSessionDirty: boolean
  readonly hasEditor: boolean
}

export interface CommandExecutionContext extends CommandContext {
  readonly toggleSidebar: () => void
  readonly openAbout: () => Promise<void>
}

export type CommandResult =
  | { readonly status: 'executed' }
  | { readonly status: 'not-found'; readonly id: string }
  | { readonly status: 'not-visible'; readonly id: CommandId }
  | { readonly status: 'disabled'; readonly id: CommandId }
  | {
      readonly status: 'failed'
      readonly id: CommandId
      readonly messageKey: 'errors.internal.unexpected'
    }

export interface AppCommand {
  readonly id: CommandId
  readonly labelKey: CommandLabelKey
  readonly defaultShortcut?: string
  readonly getState: (context: CommandContext) => CommandState
  readonly run: (context: CommandExecutionContext) => Promise<CommandResult>
}
