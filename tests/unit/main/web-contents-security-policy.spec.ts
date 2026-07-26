import type { WebContents } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExternalOpenPort } from '../../../src/main/security/external-url-policy'
import { installWebContentsSecurityPolicy } from '../../../src/main/security/web-contents-security-policy'

const electronState = vi.hoisted(() => ({
  parentWindow: null as { isDestroyed: () => boolean } | null
}))

vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(() => electronState.parentWindow)
  },
  dialog: {
    showMessageBox: vi.fn()
  },
  shell: {
    openExternal: vi.fn()
  }
}))

interface PreventableEvent {
  preventDefault(): void
}

interface NavigationDetails extends PreventableEvent {
  readonly isMainFrame: boolean
  readonly url: string
}

type FrameNavigationListener = (details: NavigationDetails) => void
type RedirectListener = (event: PreventableEvent) => void
type AttachWebviewListener = (event: PreventableEvent) => void
type WindowOpenHandler = (details: { readonly url: string }) => { readonly action: 'deny' }

function requireValue<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`${name} was not registered`)
  return value
}

function createContentsHarness(): {
  readonly contents: WebContents
  readonly getFrameNavigationListener: () => FrameNavigationListener | undefined
  readonly getRedirectListener: () => RedirectListener | undefined
  readonly getAttachWebviewListener: () => AttachWebviewListener | undefined
  readonly getWindowOpenHandler: () => WindowOpenHandler | undefined
} {
  let frameNavigationListener: FrameNavigationListener | undefined
  let redirectListener: RedirectListener | undefined
  let attachWebviewListener: AttachWebviewListener | undefined
  let windowOpenHandler: WindowOpenHandler | undefined

  const target = {
    on: (eventName: string, listener: unknown) => {
      if (eventName === 'will-frame-navigate') {
        frameNavigationListener = listener as FrameNavigationListener
      } else if (eventName === 'will-redirect') {
        redirectListener = listener as RedirectListener
      } else if (eventName === 'will-attach-webview') {
        attachWebviewListener = listener as AttachWebviewListener
      }
      return target
    },
    setWindowOpenHandler: (handler: WindowOpenHandler) => {
      windowOpenHandler = handler
    }
  }

  return {
    contents: target as unknown as WebContents,
    getFrameNavigationListener: () => frameNavigationListener,
    getRedirectListener: () => redirectListener,
    getAttachWebviewListener: () => attachWebviewListener,
    getWindowOpenHandler: () => windowOpenHandler
  }
}

function createExternalOpenPort(): {
  readonly port: ExternalOpenPort
  readonly confirm: ReturnType<typeof vi.fn<ExternalOpenPort['confirm']>>
  readonly open: ReturnType<typeof vi.fn<ExternalOpenPort['open']>>
} {
  const confirm = vi.fn<ExternalOpenPort['confirm']>().mockResolvedValue(false)
  const open = vi.fn<ExternalOpenPort['open']>().mockResolvedValue()
  return { port: { confirm, open }, confirm, open }
}

describe('web contents security policy', () => {
  beforeEach(() => {
    electronState.parentWindow = null
  })

  it('SEC-004 synchronously denies frame navigation and only sends main-frame URLs for confirmation', () => {
    const harness = createContentsHarness()
    const external = createExternalOpenPort()
    installWebContentsSecurityPolicy(harness.contents, external.port)
    const listener = requireValue(harness.getFrameNavigationListener(), 'frame navigation listener')
    const mainFrameEvent = { preventDefault: vi.fn() }
    const subFrameEvent = { preventDefault: vi.fn() }

    listener({
      preventDefault: mainFrameEvent.preventDefault,
      isMainFrame: true,
      url: 'https://example.com/main'
    })
    listener({
      preventDefault: subFrameEvent.preventDefault,
      isMainFrame: false,
      url: 'https://example.com/frame'
    })

    expect(mainFrameEvent.preventDefault).toHaveBeenCalledOnce()
    expect(subFrameEvent.preventDefault).toHaveBeenCalledOnce()
    expect(external.confirm).toHaveBeenCalledOnce()
    expect(external.confirm).toHaveBeenCalledWith(null, 'https://example.com/main')
  })

  it('SEC-004 synchronously denies redirects and webview attachment without opening a URL', () => {
    const harness = createContentsHarness()
    const external = createExternalOpenPort()
    installWebContentsSecurityPolicy(harness.contents, external.port)
    const redirectEvent = { preventDefault: vi.fn() }
    const webviewEvent = { preventDefault: vi.fn() }

    requireValue(harness.getRedirectListener(), 'redirect listener')(redirectEvent)
    requireValue(harness.getAttachWebviewListener(), 'webview listener')(webviewEvent)

    expect(redirectEvent.preventDefault).toHaveBeenCalledOnce()
    expect(webviewEvent.preventDefault).toHaveBeenCalledOnce()
    expect(external.confirm).not.toHaveBeenCalled()
    expect(external.open).not.toHaveBeenCalled()
  })

  it('SEC-004 synchronously denies new windows while sending the requested URL for confirmation', () => {
    const harness = createContentsHarness()
    const external = createExternalOpenPort()
    installWebContentsSecurityPolicy(harness.contents, external.port)

    const result = requireValue(
      harness.getWindowOpenHandler(),
      'window open handler'
    )({
      url: 'mailto:editor@example.com'
    })

    expect(result).toEqual({ action: 'deny' })
    expect(external.confirm).toHaveBeenCalledWith(null, 'mailto:editor@example.com')
  })

  it('SEC-004 uses a live owner window as the external-link dialog parent', () => {
    const liveParent = { isDestroyed: () => false }
    electronState.parentWindow = liveParent
    const harness = createContentsHarness()
    const external = createExternalOpenPort()
    installWebContentsSecurityPolicy(harness.contents, external.port)

    requireValue(
      harness.getWindowOpenHandler(),
      'window open handler'
    )({
      url: 'https://example.com/'
    })

    expect(external.confirm).toHaveBeenCalledWith(liveParent, 'https://example.com/')
  })

  it('SEC-004 removes a destroyed owner window from the confirmation boundary', () => {
    electronState.parentWindow = { isDestroyed: () => true }
    const harness = createContentsHarness()
    const external = createExternalOpenPort()
    installWebContentsSecurityPolicy(harness.contents, external.port)

    requireValue(
      harness.getWindowOpenHandler(),
      'window open handler'
    )({
      url: 'https://example.com/'
    })

    expect(external.confirm).toHaveBeenCalledWith(null, 'https://example.com/')
  })
})
