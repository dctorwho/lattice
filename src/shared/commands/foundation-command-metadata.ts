import type { CommandId } from '../contracts/command'

export type CommandLabelKey = 'commands.app.about' | 'commands.view.toggleSidebar'
export type FoundationCommandShortcut = 'F1' | 'CommandOrControl+Shift+L'
export type FoundationMenuGroup = 'help' | 'view'

export interface FoundationCommandMetadata {
  readonly id: CommandId
  readonly labelKey: CommandLabelKey
  readonly defaultShortcut: FoundationCommandShortcut
  readonly menuGroup: FoundationMenuGroup
  readonly menuType: 'normal' | 'checkbox'
}

export const foundationCommandMetadata = Object.freeze({
  'app.about': Object.freeze({
    id: 'app.about',
    labelKey: 'commands.app.about',
    defaultShortcut: 'F1',
    menuGroup: 'help',
    menuType: 'normal'
  }),
  'view.toggleSidebar': Object.freeze({
    id: 'view.toggleSidebar',
    labelKey: 'commands.view.toggleSidebar',
    defaultShortcut: 'CommandOrControl+Shift+L',
    menuGroup: 'view',
    menuType: 'checkbox'
  })
}) satisfies Readonly<Record<CommandId, FoundationCommandMetadata>>
