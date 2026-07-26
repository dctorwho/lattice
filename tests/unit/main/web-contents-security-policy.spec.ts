import { BrowserWindow } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExternalOpenPort } from '../../../src/main/security/external-url-policy'
import {
  installWebContentsSecurityPolicyHandlers,
  type AttachWebviewEvent,
  type AttachWebviewListener,
  type FrameNavigationEvent,
  type FrameNavigationListener,
  type RedirectEvent,
  type RedirectListener,
  type WebContentsSecurityPolicyTarget,
  type WindowOpenHandler
} from '../../../src/main/security/web-contents-security-policy'

const electronState = vi.hoisted(
  (): { parentWindow: BrowserWindow | null; destroyedWindows: WeakSet<object> } => ({
    parentWindow: null,
    destroyedWindows: new WeakSet()
  })
)

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {
    isDestroyed(): boolean {
      return electronState.destroyedWindows.has(this)
    }
  },
  dialog: {
    showMessageBox: vi.fn()
  },
  shell: {
    openExternal: vi.fn()
  }
}))

function requireValue<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(`${name} was not registered`)
  return value
}

function createContentsHarness(): {
  readonly target: WebContentsSecurityPolicyTarget
  readonly getFrameNavigationListener: () => FrameNavigationListener | undefined
  readonly getRedirectListener: () => RedirectListener | undefined
  readonly getAttachWebviewListener: () => AttachWebviewListener | undefined
  readonly getWindowOpenHandler: () => WindowOpenHandler | undefined
} {
  let frameNavigationListener: FrameNavigationListener | undefined
  let redirectListener: RedirectListener | undefined
  let attachWebviewListener: AttachWebviewListener | undefined
  let windowOpenHandler: WindowOpenHandler | undefined

  return {
    target: {
      onFrameNavigation: (listener) => {
        frameNavigationListener = listener
      },
      onRedirect: (listener) => {
        redirectListener = listener
      },
      onAttachWebview: (listener) => {
        attachWebviewListener = listener
      },
      setWindowOpenHandler: (handler) => {
        windowOpenHandler = handler
      },
      getParentWindow: () => electronState.parentWindow
    },
    getFrameNavigationListener: () => frameNavigationListener,
    getRedirectListener: () => redirectListener,
    getAttachWebviewListener: () => attachWebviewListener,
    getWindowOpenHandler: () => windowOpenHandler
  }
}

function createFrameNavigationEvent(
  url: string,
  isMainFrame: boolean,
  preventDefault: () => void
): FrameNavigationEvent {
  return {
    preventDefault,
    defaultPrevented: false,
    url,
    isSameDocument: false,
    isMainFrame,
    frame: null
  }
}

function createRedirectEvent(preventDefault: () => void): RedirectEvent {
  return {
    preventDefault,
    defaultPrevented: false,
    url: 'https://redirect.example/',
    isSameDocument: false,
    isMainFrame: true,
    frame: null
  }
}

function createAttachWebviewEvent(preventDefault: () => void): AttachWebviewEvent {
  return {
    preventDefault,
    defaultPrevented: false
  }
}

function createWindowOpenDetails(url: string): Parameters<WindowOpenHandler>[0] {
  return {
    url,
    frameName: '',
    features: '',
    disposition: 'default',
    referrer: {
      policy: 'no-referrer',
      url: ''
    }
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
    electronState.destroyedWindows = new WeakSet()
  })

  it('SEC-004 synchronously denies frame navigation and only sends main-frame URLs for confirmation', () => {
    const harness = createContentsHarness()
    const external = createExternalOpenPort()
    installWebContentsSecurityPolicyHandlers(harness.target, external.port)
    const listener = requireValue(harness.getFrameNavigationListener(), 'frame navigation listener')
    const mainFramePreventDefault = vi.fn()
    const subFramePreventDefault = vi.fn()

    listener(createFrameNavigationEvent('https://example.com/main', true, mainFramePreventDefault))
    listener(createFrameNavigationEvent('https://example.com/frame', false, subFramePreventDefault))

    expect(mainFramePreventDefault).toHaveBeenCalledOnce()
    expect(subFramePreventDefault).toHaveBeenCalledOnce()
    expect(external.confirm).toHaveBeenCalledOnce()
    expect(external.confirm).toHaveBeenCalledWith(null, 'https://example.com/main')
  })

  it('SEC-004 synchronously denies redirects and webview attachment without opening a URL', () => {
    const harness = createContentsHarness()
    const external = createExternalOpenPort()
    installWebContentsSecurityPolicyHandlers(harness.target, external.port)
    const redirectPreventDefault = vi.fn()
    const webviewPreventDefault = vi.fn()

    requireValue(
      harness.getRedirectListener(),
      'redirect listener'
    )(createRedirectEvent(redirectPreventDefault))
    requireValue(
      harness.getAttachWebviewListener(),
      'webview listener'
    )(createAttachWebviewEvent(webviewPreventDefault))

    expect(redirectPreventDefault).toHaveBeenCalledOnce()
    expect(webviewPreventDefault).toHaveBeenCalledOnce()
    expect(external.confirm).not.toHaveBeenCalled()
    expect(external.open).not.toHaveBeenCalled()
  })

  it('SEC-004 synchronously denies new windows while sending the requested URL for confirmation', () => {
    const harness = createContentsHarness()
    const external = createExternalOpenPort()
    installWebContentsSecurityPolicyHandlers(harness.target, external.port)

    const result = requireValue(
      harness.getWindowOpenHandler(),
      'window open handler'
    )(createWindowOpenDetails('mailto:editor@example.com'))

    expect(result).toEqual({ action: 'deny' })
    expect(external.confirm).toHaveBeenCalledWith(null, 'mailto:editor@example.com')
  })

  it('SEC-004 uses a live owner window as the external-link dialog parent', () => {
    const liveParent = new BrowserWindow()
    electronState.parentWindow = liveParent
    const harness = createContentsHarness()
    const external = createExternalOpenPort()
    installWebContentsSecurityPolicyHandlers(harness.target, external.port)

    requireValue(
      harness.getWindowOpenHandler(),
      'window open handler'
    )(createWindowOpenDetails('https://example.com/'))

    expect(external.confirm).toHaveBeenCalledWith(liveParent, 'https://example.com/')
  })

  it('SEC-004 removes a destroyed owner window from the confirmation boundary', () => {
    const destroyedParent = new BrowserWindow()
    electronState.destroyedWindows.add(destroyedParent)
    electronState.parentWindow = destroyedParent
    const harness = createContentsHarness()
    const external = createExternalOpenPort()
    installWebContentsSecurityPolicyHandlers(harness.target, external.port)

    requireValue(
      harness.getWindowOpenHandler(),
      'window open handler'
    )(createWindowOpenDetails('https://example.com/'))

    expect(external.confirm).toHaveBeenCalledWith(null, 'https://example.com/')
  })
})
