import { app, BrowserWindow, session } from 'electron'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeApplication } from './bootstrap/compose-application'
import { createMainWindow } from './bootstrap/create-main-window'
import { resolveMainWindowOptions } from './bootstrap/resolve-main-window-options'
import { installSessionSecurityPolicy } from './security/session-security-policy'
import { installWebContentsSecurityPolicy } from './security/web-contents-security-policy'

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const electronRendererUrl = process.env.ELECTRON_RENDERER_URL
const mainWindowOptions = resolveMainWindowOptions(
  electronRendererUrl === undefined
    ? { currentDirectory, isPackaged: app.isPackaged }
    : { currentDirectory, isPackaged: app.isPackaged, electronRendererUrl }
)

composeApplication(mainWindowOptions, {
  platform: process.platform,
  enableSandbox: () => {
    app.enableSandbox()
  },
  registerWebContentsCreated: (listener) => {
    app.on('web-contents-created', (_event, contents) => {
      listener(contents)
    })
  },
  whenReady: () => app.whenReady(),
  installWebContentsSecurityPolicy,
  installSessionSecurityPolicy: (development) => {
    installSessionSecurityPolicy(session.defaultSession, development)
  },
  createMainWindow,
  registerActivate: (listener) => {
    app.on('activate', listener)
  },
  hasOpenWindows: () => BrowserWindow.getAllWindows().length > 0,
  registerWindowAllClosed: (listener) => {
    app.on('window-all-closed', listener)
  },
  quit: () => {
    app.quit()
  }
})
