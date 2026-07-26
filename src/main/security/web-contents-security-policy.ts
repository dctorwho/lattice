import { BrowserWindow } from 'electron'
import type {
  Event,
  WebContents,
  WebContentsWillFrameNavigateEventParams,
  WebContentsWillRedirectEventParams
} from 'electron'

import {
  electronExternalOpenPort,
  requestExternalOpen,
  type ExternalOpenPort
} from './external-url-policy'

export type FrameNavigationEvent = Event<WebContentsWillFrameNavigateEventParams>
export type RedirectEvent = Event<WebContentsWillRedirectEventParams>
export type AttachWebviewEvent = Event
export type FrameNavigationListener = (details: FrameNavigationEvent) => void
export type RedirectListener = (details: RedirectEvent) => void
export type AttachWebviewListener = (event: AttachWebviewEvent) => void
export type WindowOpenHandler = Parameters<WebContents['setWindowOpenHandler']>[0]

export interface WebContentsSecurityPolicyTarget {
  readonly onFrameNavigation: (listener: FrameNavigationListener) => void
  readonly onRedirect: (listener: RedirectListener) => void
  readonly onAttachWebview: (listener: AttachWebviewListener) => void
  readonly setWindowOpenHandler: (handler: WindowOpenHandler) => void
  readonly getParentWindow: () => BrowserWindow | null
}

export function installWebContentsSecurityPolicyHandlers(
  target: WebContentsSecurityPolicyTarget,
  externalOpenPort: ExternalOpenPort
): void {
  const parentWindow = (): BrowserWindow | null => {
    const candidate = target.getParentWindow()
    return candidate === null || candidate.isDestroyed() ? null : candidate
  }

  target.onFrameNavigation((details) => {
    details.preventDefault()
    if (details.isMainFrame) {
      void requestExternalOpen(parentWindow(), details.url, externalOpenPort)
    }
  })

  target.onRedirect((event) => {
    event.preventDefault()
  })

  target.onAttachWebview((event) => {
    event.preventDefault()
  })

  target.setWindowOpenHandler(({ url }) => {
    void requestExternalOpen(parentWindow(), url, externalOpenPort)
    return { action: 'deny' }
  })
}

export function installWebContentsSecurityPolicy(
  contents: WebContents,
  externalOpenPort: ExternalOpenPort = electronExternalOpenPort
): void {
  installWebContentsSecurityPolicyHandlers(
    {
      onFrameNavigation: (listener) => {
        contents.on('will-frame-navigate', listener)
      },
      onRedirect: (listener) => {
        contents.on('will-redirect', listener)
      },
      onAttachWebview: (listener) => {
        contents.on('will-attach-webview', listener)
      },
      setWindowOpenHandler: (handler) => {
        contents.setWindowOpenHandler(handler)
      },
      getParentWindow: () => BrowserWindow.fromWebContents(contents)
    },
    externalOpenPort
  )
}
