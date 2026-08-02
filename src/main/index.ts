import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  session,
  type IpcMainInvokeEvent,
  type WebContents,
  type WebFrameMain
} from 'electron'
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeApplication } from './bootstrap/compose-application'
import { createMainWindow, type CreateMainWindowOptions } from './bootstrap/create-main-window'
import { resolveMainWindowOptions } from './bootstrap/resolve-main-window-options'
import { createApplicationMenu, type CommandTarget } from './commands/application-menu'
import { AuthorizedWindowRegistry } from './ipc/authorized-window-registry'
import { createAppInfo } from './ipc/create-app-info'
import { createIpcRouter, defineIpcRoute } from './ipc/create-ipc-router'
import { createConsoleIpcErrorLogSink } from './ipc/ipc-error-logger'
import { registerAppInfoIpc } from './ipc/register-app-info-ipc'
import { registerCommandStateIpc } from './ipc/register-command-state-ipc'
import { installSessionSecurityPolicy } from './security/session-security-policy'
import { installWebContentsSecurityPolicy } from './security/web-contents-security-policy'
import {
  APP_GET_INFO_CHANNEL,
  COMMAND_UPDATE_STATES_CHANNEL,
  appGetInfoRequestSchema,
  appGetInfoResultSchema,
  commandStateSyncRequestSchema,
  commandStateSyncResultSchema
} from '../shared/contracts'

function appInfoPlatform(platform: NodeJS.Platform): 'win32' | 'darwin' | 'linux' {
  switch (platform) {
    case 'win32':
    case 'darwin':
    case 'linux':
      return platform
    default:
      throw new Error('Unsupported application platform')
  }
}

app.setName('Lattice')

const currentDirectory = dirname(fileURLToPath(import.meta.url))
const electronRendererUrl = process.env.ELECTRON_RENDERER_URL
const mainWindowOptions = resolveMainWindowOptions(
  electronRendererUrl === undefined
    ? { currentDirectory, isPackaged: app.isPackaged }
    : { currentDirectory, isPackaged: app.isPackaged, electronRendererUrl }
)

const authorizedWindows = new AuthorizedWindowRegistry<WebContents>()
const applicationMenu = createApplicationMenu({
  locale: 'zh-CN',
  adapter: {
    buildFromTemplate: (template) =>
      Menu.buildFromTemplate(
        template.map((group) => ({
          label: group.label,
          submenu: group.submenu.map((item) => ({
            id: item.id,
            label: item.label,
            accelerator: item.accelerator,
            type: item.type,
            visible: item.visible,
            enabled: item.enabled,
            checked: item.checked,
            click: item.click
          }))
        }))
      ),
    setApplicationMenu: (menu) => {
      Menu.setApplicationMenu(menu)
    },
    getMenuItemById: (menu, id) => menu.getMenuItemById(id) ?? undefined
  },
  resolveFocusedTarget: (): CommandTarget | undefined => {
    const window = BrowserWindow.getFocusedWindow()
    if (window === null || window.isDestroyed() || window.webContents.isDestroyed()) {
      return undefined
    }
    const registered = authorizedWindows.find(window.webContents.id)
    if (
      registered === undefined ||
      registered.windowId !== window.id ||
      registered.sender !== window.webContents
    ) {
      return undefined
    }
    try {
      if (registered.isWindowDestroyed()) return undefined
    } catch {
      return undefined
    }
    return {
      windowId: window.id,
      send: (channel, event) => {
        window.webContents.send(channel, event)
      }
    }
  }
})
const appInfoRoute = defineIpcRoute({
  channel: APP_GET_INFO_CHANNEL,
  requestSchema: appGetInfoRequestSchema,
  responseSchema: appGetInfoResultSchema,
  handle: () =>
    Promise.resolve({
      ok: true,
      value: createAppInfo({
        getName: () => app.getName(),
        getVersion: () => app.getVersion(),
        platform: appInfoPlatform(process.platform)
      })
    })
})
const commandStateRoute = defineIpcRoute({
  channel: COMMAND_UPDATE_STATES_CHANNEL,
  requestSchema: commandStateSyncRequestSchema,
  responseSchema: commandStateSyncResultSchema,
  handle: (request, context) => {
    if (!applicationMenu.updateStates(context.windowId, request.payload.states)) {
      throw new Error('Validated command state could not be applied')
    }
    return Promise.resolve({
      ok: true,
      value: { contractVersion: 1, applied: true }
    })
  }
})
const router = createIpcRouter<WebContents, WebFrameMain>({
  registry: authorizedWindows,
  routes: [appInfoRoute, commandStateRoute],
  createRequestId: randomUUID,
  log: createConsoleIpcErrorLogSink({
    warn: (label, event) => {
      console.warn(label, event)
    },
    error: (label, event) => {
      console.error(label, event)
    }
  })
})

registerAppInfoIpc<IpcMainInvokeEvent>(ipcMain, {
  dispatch: (channel, event, input) =>
    router.dispatch(
      channel,
      {
        sender: event.sender,
        senderId: event.sender.id,
        senderFrame: event.senderFrame,
        mainFrame: event.sender.mainFrame,
        isSenderDestroyed: () => event.sender.isDestroyed()
      },
      input
    )
})
registerCommandStateIpc<IpcMainInvokeEvent>(ipcMain, {
  dispatch: (channel, event, input) =>
    router.dispatch(
      channel,
      {
        sender: event.sender,
        senderId: event.sender.id,
        senderFrame: event.senderFrame,
        mainFrame: event.sender.mainFrame,
        isSenderDestroyed: () => event.sender.isDestroyed()
      },
      input
    )
})

function createRegisteredMainWindow(options: CreateMainWindowOptions): void {
  const window = createMainWindow(options)
  const unregister = authorizedWindows.register({
    windowId: window.id,
    webContentsId: window.webContents.id,
    sender: window.webContents,
    isWindowDestroyed: () => window.isDestroyed()
  })
  let cleaned = false
  const cleanup = (): void => {
    if (cleaned) return
    cleaned = true
    applicationMenu.removeWindow(window.id)
    unregister()
  }
  window.on('focus', applicationMenu.applyForFocusedWindow)
  window.on('blur', applicationMenu.applyForFocusedWindow)
  window.once('closed', cleanup)
  window.webContents.once('destroyed', cleanup)
}

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
  installApplicationMenu: applicationMenu.install,
  createMainWindow: createRegisteredMainWindow,
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
