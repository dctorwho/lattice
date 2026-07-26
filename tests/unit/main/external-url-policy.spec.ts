import { describe, expect, it, vi } from 'vitest'

import {
  decideExternalUrl,
  maximumExternalUrlLength,
  requestExternalOpen,
  type ExternalOpenPort
} from '../../../src/main/security/external-url-policy'

const allowed = [
  ['https://example.com/path?q=1#fragment', 'https:', 'https://example.com/path?q=1#fragment'],
  ['HTTPS://EXAMPLE.COM/Path', 'https:', 'https://example.com/Path'],
  ['mailto:editor@example.com', 'mailto:', 'mailto:editor@example.com'],
  ['MAILTO:editor@example.com?subject=Hello', 'mailto:', 'mailto:editor@example.com?subject=Hello']
] as const

const denied = [
  ['', 'empty'],
  [' https://example.com', 'control-character'],
  ['https://example.com\n', 'control-character'],
  ['https://user:secret@example.com', 'credentials'],
  ['https:///missing-host', 'target'],
  ['mailto:', 'target'],
  ['mailto:?subject=missing-recipient', 'target'],
  ['http://example.com', 'protocol'],
  ['file:///C:/Windows/System32/calc.exe', 'protocol'],
  ['javascript:alert(1)', 'protocol'],
  ['JaVaScRiPt:alert(1)', 'protocol'],
  ['data:text/html,<script>alert(1)</script>', 'protocol'],
  ['custom://example', 'protocol'],
  ['%6a%61vascript:alert(1)', 'invalid']
] as const

function createPort(
  confirmed: boolean,
  openImplementation: (normalizedUrl: string) => Promise<void> = () => Promise.resolve()
): {
  readonly port: ExternalOpenPort
  readonly confirm: ReturnType<typeof vi.fn<ExternalOpenPort['confirm']>>
  readonly open: ReturnType<typeof vi.fn<ExternalOpenPort['open']>>
} {
  const confirm = vi.fn<ExternalOpenPort['confirm']>().mockResolvedValue(confirmed)
  const open = vi.fn<ExternalOpenPort['open']>().mockImplementation(openImplementation)

  return { port: { confirm, open }, confirm, open }
}

describe('external URL policy', () => {
  it.each(allowed)(
    'SEC-005 confirms normalized allowed URL %s',
    (rawUrl, protocol, normalizedUrl) => {
      expect(decideExternalUrl(rawUrl)).toEqual({ kind: 'confirm', protocol, normalizedUrl })
    }
  )

  it.each(denied)('SEC-005 denies unsafe URL %s', (rawUrl, reason) => {
    expect(decideExternalUrl(rawUrl)).toEqual({ kind: 'deny', reason })
  })

  it('SEC-005 denies a URL longer than the UTF-16 code unit limit', () => {
    const rawUrl = `https://example.com/${'a'.repeat(maximumExternalUrlLength)}`

    expect(rawUrl.length).toBeGreaterThan(maximumExternalUrlLength)
    expect(decideExternalUrl(rawUrl)).toEqual({ kind: 'deny', reason: 'too-long' })
  })

  it('SEC-005 denies without confirming or opening', async () => {
    const { port, confirm, open } = createPort(true)

    await expect(requestExternalOpen(null, 'http://example.com', port)).resolves.toBe('denied')
    expect(confirm).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  it('SEC-005 returns cancelled without opening when confirmation is declined', async () => {
    const { port, open } = createPort(false)

    await expect(requestExternalOpen(null, 'https://example.com', port)).resolves.toBe('cancelled')
    expect(open).not.toHaveBeenCalled()
  })

  it('SEC-005 opens the normalized URL after confirmation', async () => {
    const { port, open } = createPort(true)

    await expect(requestExternalOpen(null, 'https://example.com', port)).resolves.toBe('opened')
    expect(open).toHaveBeenCalledWith('https://example.com/')
  })

  it('SEC-005 returns failed when confirmation or opening rejects', async () => {
    const failingConfirm = vi
      .fn<ExternalOpenPort['confirm']>()
      .mockRejectedValue(new Error('dialog failed'))
    const failingOpen = vi
      .fn<ExternalOpenPort['open']>()
      .mockRejectedValue(new Error('shell failed'))
    const failingPort: ExternalOpenPort = { confirm: failingConfirm, open: failingOpen }

    await expect(requestExternalOpen(null, 'mailto:a@example.com', failingPort)).resolves.toBe(
      'failed'
    )
  })
})
