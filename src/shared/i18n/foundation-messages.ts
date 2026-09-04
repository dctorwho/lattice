import type { CommandLabelKey } from '../commands'

export type FoundationLocale = 'zh-CN' | 'en'
export type FoundationMenuLabelKey = 'menus.edit' | 'menus.file' | 'menus.help' | 'menus.view'
export type FoundationMessageKey = CommandLabelKey | FoundationMenuLabelKey

export const foundationMessages = Object.freeze({
  'zh-CN': Object.freeze({
    'commands.app.about': '关于 Lattice',
    'commands.edit.find': '查找',
    'commands.edit.redo': '重做',
    'commands.edit.replace': '替换',
    'commands.edit.undo': '撤销',
    'commands.file.close': '关闭文档',
    'commands.file.new': '新建',
    'commands.file.open': '打开…',
    'commands.file.save': '保存',
    'commands.file.saveAs': '另存为…',
    'commands.view.toggleSidebar': '切换侧栏',
    'menus.edit': '编辑',
    'menus.file': '文件',
    'menus.help': '帮助',
    'menus.view': '视图'
  }),
  en: Object.freeze({
    'commands.app.about': 'About Lattice',
    'commands.edit.find': 'Find',
    'commands.edit.redo': 'Redo',
    'commands.edit.replace': 'Replace',
    'commands.edit.undo': 'Undo',
    'commands.file.close': 'Close Document',
    'commands.file.new': 'New',
    'commands.file.open': 'Open…',
    'commands.file.save': 'Save',
    'commands.file.saveAs': 'Save As…',
    'commands.view.toggleSidebar': 'Toggle Sidebar',
    'menus.edit': 'Edit',
    'menus.file': 'File',
    'menus.help': 'Help',
    'menus.view': 'View'
  })
}) satisfies Readonly<Record<FoundationLocale, Readonly<Record<FoundationMessageKey, string>>>>

export function translateFoundationMessage(
  locale: FoundationLocale,
  key: FoundationMessageKey
): string {
  return foundationMessages[locale][key]
}
