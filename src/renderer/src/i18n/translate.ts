import { enMessages, zhCNMessages, type Locale, type MessageKey } from './messages'

const catalogs = {
  'zh-CN': zhCNMessages,
  en: enMessages
} as const satisfies Readonly<Record<Locale, Readonly<Record<MessageKey, string>>>>

export function translate(
  locale: Locale,
  key: MessageKey,
  parameters: Readonly<Record<string, string | number>> = {}
): string {
  return Object.entries(parameters).reduce<string>(
    (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
    String(catalogs[locale][key])
  )
}
