import { dialog, shell } from 'electron'
import type { BrowserWindow } from 'electron'

export const maximumExternalUrlLength = 2_081

export type ExternalUrlDenialReason =
  'empty' | 'too-long' | 'control-character' | 'invalid' | 'protocol' | 'credentials' | 'target'

export type ExternalUrlDecision =
  | { readonly kind: 'deny'; readonly reason: ExternalUrlDenialReason }
  | {
      readonly kind: 'confirm'
      readonly protocol: 'https:' | 'mailto:'
      readonly normalizedUrl: string
    }

export interface ExternalOpenPort {
  readonly confirm: (parent: BrowserWindow | null, normalizedUrl: string) => Promise<boolean>
  readonly open: (normalizedUrl: string) => Promise<void>
}

export type ExternalOpenOutcome = 'denied' | 'cancelled' | 'opened' | 'failed'

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.charCodeAt(0)
    return codePoint <= 0x1f || codePoint === 0x7f
  })
}

export function decideExternalUrl(rawUrl: string): ExternalUrlDecision {
  if (rawUrl.length === 0) return { kind: 'deny', reason: 'empty' }
  if (rawUrl.length > maximumExternalUrlLength) return { kind: 'deny', reason: 'too-long' }
  if (rawUrl.trim() !== rawUrl || containsControlCharacter(rawUrl)) {
    return { kind: 'deny', reason: 'control-character' }
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { kind: 'deny', reason: 'invalid' }
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'mailto:') {
    return { kind: 'deny', reason: 'protocol' }
  }
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return { kind: 'deny', reason: 'credentials' }
  }
  if (
    parsed.protocol === 'https:' &&
    (rawUrl.slice('https:'.length, 'https:'.length + 2) !== '//' ||
      rawUrl.charAt('https:'.length + 2) === '/')
  ) {
    return { kind: 'deny', reason: 'target' }
  }
  if (parsed.protocol === 'https:' && parsed.hostname.length === 0) {
    return { kind: 'deny', reason: 'target' }
  }
  if (parsed.protocol === 'mailto:' && parsed.pathname.length === 0) {
    return { kind: 'deny', reason: 'target' }
  }

  return {
    kind: 'confirm',
    protocol: parsed.protocol,
    normalizedUrl: parsed.href
  }
}

export async function requestExternalOpen(
  parent: BrowserWindow | null,
  rawUrl: string,
  port: ExternalOpenPort
): Promise<ExternalOpenOutcome> {
  const decision = decideExternalUrl(rawUrl)
  if (decision.kind === 'deny') return 'denied'

  try {
    const confirmed = await port.confirm(parent, decision.normalizedUrl)
    if (!confirmed) return 'cancelled'
    await port.open(decision.normalizedUrl)
    return 'opened'
  } catch {
    return 'failed'
  }
}

export const electronExternalOpenPort: ExternalOpenPort = {
  confirm: async (parent, normalizedUrl) => {
    const options = {
      type: 'question' as const,
      buttons: ['Open', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
      title: 'Open external link?',
      message: 'Open this link in your default application?',
      detail: normalizedUrl
    }
    const result =
      parent === null
        ? await dialog.showMessageBox(options)
        : await dialog.showMessageBox(parent, options)
    return result.response === 0
  },
  open: async (normalizedUrl) => {
    await shell.openExternal(normalizedUrl)
  }
}
