import { enMessages, zhCNMessages, type Locale, type MessageKey } from './messages'

const catalogs = {
  'zh-CN': zhCNMessages,
  en: enMessages
} as const satisfies Readonly<Record<Locale, Readonly<Record<MessageKey, string>>>>

export function translate(locale: Locale, key: MessageKey): string {
  return catalogs[locale][key]
}
