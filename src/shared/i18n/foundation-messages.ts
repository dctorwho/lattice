import type { CommandLabelKey } from '../commands'

export type FoundationLocale = 'zh-CN' | 'en'
export type FoundationMenuLabelKey = 'menus.help' | 'menus.view'
export type FoundationMessageKey = CommandLabelKey | FoundationMenuLabelKey

export const foundationMessages = Object.freeze({
  'zh-CN': Object.freeze({
    'commands.app.about': '关于 Lattice',
    'commands.view.toggleSidebar': '切换侧栏',
    'menus.help': '帮助',
    'menus.view': '视图'
  }),
  en: Object.freeze({
    'commands.app.about': 'About Lattice',
    'commands.view.toggleSidebar': 'Toggle Sidebar',
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
