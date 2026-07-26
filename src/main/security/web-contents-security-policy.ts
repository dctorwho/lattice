import { BrowserWindow } from 'electron'
import type { WebContents } from 'electron'

import {
  electronExternalOpenPort,
  requestExternalOpen,
  type ExternalOpenPort
} from './external-url-policy'

export function installWebContentsSecurityPolicy(
  contents: WebContents,
  externalOpenPort: ExternalOpenPort = electronExternalOpenPort
): void {
  const parentWindow = (): BrowserWindow | null => {
    const candidate = BrowserWindow.fromWebContents(contents)
    return candidate === null || candidate.isDestroyed() ? null : candidate
  }

  contents.on('will-frame-navigate', (details) => {
    details.preventDefault()
    if (details.isMainFrame) {
      void requestExternalOpen(parentWindow(), details.url, externalOpenPort)
    }
  })

  contents.on('will-redirect', (event) => {
    event.preventDefault()
  })

  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })

  contents.setWindowOpenHandler(({ url }) => {
    void requestExternalOpen(parentWindow(), url, externalOpenPort)
    return { action: 'deny' }
  })
}
