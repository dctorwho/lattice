import type { CommandId, CommandState } from '../../shared/contracts/command'
import type { CommandLabelKey, FoundationCommandShortcut } from '../../shared/commands'

export type { CommandId, CommandState }
export type { CommandLabelKey }

export interface CommandContext {
  readonly isSidebarVisible: boolean
  readonly isDialogOpen: boolean
  readonly isWindowFocused: boolean
  readonly hasSession: boolean
  readonly isSessionDirty: boolean
  readonly isSessionReadOnly: boolean
  readonly hasEditor: boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
}

export interface CommandExecutionContext extends CommandContext {
  readonly toggleSidebar: () => void
  readonly openAbout: () => Promise<void>
  readonly newDocument: () => void | Promise<void>
  readonly openDocument: () => void | Promise<void>
  readonly saveDocument: () => void | Promise<void>
  readonly saveDocumentAs: () => void | Promise<void>
  readonly closeDocument: () => void | Promise<void>
  readonly undo: () => void
  readonly redo: () => void
  readonly openFind: () => void
  readonly openReplace: () => void
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
  readonly defaultShortcut: FoundationCommandShortcut
  readonly getState: (context: CommandContext) => CommandState
  readonly run: (context: CommandExecutionContext) => Promise<CommandResult>
}
