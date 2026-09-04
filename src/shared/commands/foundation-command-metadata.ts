import type { CommandId } from '../contracts/command'

export type CommandLabelKey =
  | 'commands.app.about'
  | 'commands.edit.find'
  | 'commands.edit.redo'
  | 'commands.edit.replace'
  | 'commands.edit.undo'
  | 'commands.file.close'
  | 'commands.file.new'
  | 'commands.file.open'
  | 'commands.file.save'
  | 'commands.file.saveAs'
  | 'commands.view.toggleSidebar'
export type FoundationCommandShortcut =
  | 'F1'
  | 'CommandOrControl+F'
  | 'CommandOrControl+H'
  | 'CommandOrControl+N'
  | 'CommandOrControl+O'
  | 'CommandOrControl+S'
  | 'CommandOrControl+Shift+L'
  | 'CommandOrControl+Shift+S'
  | 'CommandOrControl+W'
  | 'CommandOrControl+Y'
  | 'CommandOrControl+Z'
export type FoundationMenuGroup = 'edit' | 'file' | 'help' | 'view'

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
  'edit.find': Object.freeze({
    id: 'edit.find',
    labelKey: 'commands.edit.find',
    defaultShortcut: 'CommandOrControl+F',
    menuGroup: 'edit',
    menuType: 'normal'
  }),
  'edit.redo': Object.freeze({
    id: 'edit.redo',
    labelKey: 'commands.edit.redo',
    defaultShortcut: 'CommandOrControl+Y',
    menuGroup: 'edit',
    menuType: 'normal'
  }),
  'edit.replace': Object.freeze({
    id: 'edit.replace',
    labelKey: 'commands.edit.replace',
    defaultShortcut: 'CommandOrControl+H',
    menuGroup: 'edit',
    menuType: 'normal'
  }),
  'edit.undo': Object.freeze({
    id: 'edit.undo',
    labelKey: 'commands.edit.undo',
    defaultShortcut: 'CommandOrControl+Z',
    menuGroup: 'edit',
    menuType: 'normal'
  }),
  'file.close': Object.freeze({
    id: 'file.close',
    labelKey: 'commands.file.close',
    defaultShortcut: 'CommandOrControl+W',
    menuGroup: 'file',
    menuType: 'normal'
  }),
  'file.new': Object.freeze({
    id: 'file.new',
    labelKey: 'commands.file.new',
    defaultShortcut: 'CommandOrControl+N',
    menuGroup: 'file',
    menuType: 'normal'
  }),
  'file.open': Object.freeze({
    id: 'file.open',
    labelKey: 'commands.file.open',
    defaultShortcut: 'CommandOrControl+O',
    menuGroup: 'file',
    menuType: 'normal'
  }),
  'file.save': Object.freeze({
    id: 'file.save',
    labelKey: 'commands.file.save',
    defaultShortcut: 'CommandOrControl+S',
    menuGroup: 'file',
    menuType: 'normal'
  }),
  'file.saveAs': Object.freeze({
    id: 'file.saveAs',
    labelKey: 'commands.file.saveAs',
    defaultShortcut: 'CommandOrControl+Shift+S',
    menuGroup: 'file',
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
