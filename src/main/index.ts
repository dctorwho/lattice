import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  type IpcMainInvokeEvent,
  type WebContents,
  type WebFrameMain
} from 'electron'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeApplication } from './bootstrap/compose-application'
import { createMainWindow, type CreateMainWindowOptions } from './bootstrap/create-main-window'
import { resolveMainWindowOptions } from './bootstrap/resolve-main-window-options'
import { createApplicationMenu, type CommandTarget } from './commands/application-menu'
import type { DocumentSession } from '../domain/documents'
import { createAtomicDocumentSaveService } from './documents/atomic-document-save-service'
import { createDocumentOpenService } from './documents/document-open-service'
import {
  createFilesConfirmedOverwriteRoute,
  createFilesOpenRoute,
  createFilesReloadExternalRoute,
  createFilesSaveAsRoute,
  createFilesSaveRoute,
  type FileConflictRecord
} from './documents/files-open-route'
import { createNodeAtomicFileSaver } from './documents/node-atomic-file-saver'
import { createNodeDocumentSnapshotReader } from './documents/node-document-snapshot-reader'
import { createNodeFileWatcherManager } from './documents/node-file-watcher'
import { createNodeRecoveryStore } from './documents/node-recovery-store'
import { createRecoveryRoutes } from './documents/recovery-routes'
import { AuthorizedWindowRegistry } from './ipc/authorized-window-registry'
import { createAppInfo } from './ipc/create-app-info'
import { createIpcRouter, defineIpcRoute } from './ipc/create-ipc-router'
import { createConsoleIpcErrorLogSink } from './ipc/ipc-error-logger'
import { registerAppInfoIpc } from './ipc/register-app-info-ipc'
import { registerCommandStateIpc } from './ipc/register-command-state-ipc'
import { registerFilesOpenIpc, registerFilesSaveIpc } from './ipc/register-files-open-ipc'
import { registerRecoveryIpc } from './ipc/register-recovery-ipc'
import { registerWindowLifecycleIpc } from './ipc/register-window-lifecycle-ipc'
import { installSessionSecurityPolicy } from './security/session-security-policy'
import { installWebContentsSecurityPolicy } from './security/web-contents-security-policy'
import {
  APP_GET_INFO_CHANNEL,
  COMMAND_UPDATE_STATES_CHANNEL,
  FILES_EXTERNAL_CHANGE_EVENT,
  appGetInfoRequestSchema,
  appGetInfoResultSchema,
  commandStateSyncRequestSchema,
  commandStateSyncResultSchema,
  WINDOW_CLOSE_DECISION_CHANNEL,
  WINDOW_CLOSE_REQUESTED_EVENT,
  windowCloseDecisionRequestSchema,
  windowCloseDecisionResultSchema,
  windowCloseRequestedEventSchema
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
const documentSessionsByWindow = new Map<number, Map<string, DocumentSession>>()
const fileConflictsByToken = new Map<string, FileConflictRecord>()
const windowsAuthorizedToClose = new Set<number>()
const windowsAwaitingCloseDecision = new Set<number>()
const readDocumentSnapshot = createNodeDocumentSnapshotReader({ maxBytes: 10 * 1024 * 1024 })
const saveDocument = createAtomicDocumentSaveService({
  saveFile: createNodeAtomicFileSaver({ createTemporaryId: randomUUID })
})
const fileWatcherManager = createNodeFileWatcherManager({
  readSnapshot: readDocumentSnapshot,
  findSession: (windowId, documentId) => documentSessionsByWindow.get(windowId)?.get(documentId),
  emit: (windowId, event) => {
    const window = BrowserWindow.fromId(windowId)
    if (window === null || window.isDestroyed() || window.webContents.isDestroyed()) return
    window.webContents.send(FILES_EXTERNAL_CHANGE_EVENT, event)
  }
})
const recoveryStore = createNodeRecoveryStore({
  rootDirectory: join(app.getPath('userData'), 'recovery-v1'),
  createTemporaryId: randomUUID,
  now: Date.now
})

function rememberWindowSession(windowId: number, documentSession: DocumentSession): void {
  const sessions = documentSessionsByWindow.get(windowId)
  if (sessions === undefined) {
    throw new Error('Authorized document window is unavailable')
  }
  sessions.set(documentSession.id, documentSession)
  fileWatcherManager.watchDocument(windowId, documentSession)
}

async function inspectOptionalTarget(path: string) {
  try {
    return await readDocumentSnapshot(path)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}
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
const windowCloseDecisionRoute = defineIpcRoute({
  channel: WINDOW_CLOSE_DECISION_CHANNEL,
  requestSchema: windowCloseDecisionRequestSchema,
  responseSchema: windowCloseDecisionResultSchema,
  handle: (request, context) => {
    windowsAwaitingCloseDecision.delete(context.windowId)
    if (request.payload.decision === 'close') {
      const window = BrowserWindow.fromId(context.windowId)
      if (window === null || window.isDestroyed()) {
        throw new Error('Authorized window is unavailable for close completion')
      }
      windowsAuthorizedToClose.add(context.windowId)
      window.close()
    }
    return Promise.resolve({ ok: true, value: { applied: true as const } })
  }
})
const filesOpenRoute = defineIpcRoute(
  createFilesOpenRoute({
    openFromPicker: async (context) => {
      const window = BrowserWindow.fromId(context.windowId)
      if (window === null || window.isDestroyed()) {
        throw new Error('Authorized window is unavailable for file selection')
      }
      const selection = await dialog.showOpenDialog(window, {
        properties: ['openFile'],
        filters: [
          { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt', 'qmd'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      })
      const service = createDocumentOpenService({
        selectFile: () =>
          Promise.resolve(selection.canceled ? null : (selection.filePaths[0] ?? null)),
        readSnapshot: readDocumentSnapshot,
        createSessionId: randomUUID
      })
      return service.openFromPicker()
    },
    rememberSession: (windowId, documentSession) => {
      if (!documentSessionsByWindow.has(windowId)) {
        documentSessionsByWindow.set(windowId, new Map<string, DocumentSession>())
      }
      rememberWindowSession(windowId, documentSession)
    }
  })
)
const filesSaveRoute = defineIpcRoute(
  createFilesSaveRoute({
    findSession: (windowId, documentId) => documentSessionsByWindow.get(windowId)?.get(documentId),
    saveSession: saveDocument.save,
    rememberSession: rememberWindowSession,
    readSnapshot: readDocumentSnapshot,
    createConflictToken: randomUUID,
    rememberConflict: (record) => {
      fileConflictsByToken.set(record.token, record)
    }
  })
)
const filesReloadExternalRoute = defineIpcRoute(
  createFilesReloadExternalRoute({
    findSession: (windowId, documentId) => documentSessionsByWindow.get(windowId)?.get(documentId),
    readSnapshot: readDocumentSnapshot,
    rememberSession: rememberWindowSession
  })
)
const filesSaveAsRoute = defineIpcRoute(
  createFilesSaveAsRoute({
    findSession: (windowId, documentId) => documentSessionsByWindow.get(windowId)?.get(documentId),
    chooseSavePath: async (context) => {
      const window = BrowserWindow.fromId(context.windowId)
      if (window === null || window.isDestroyed()) {
        throw new Error('Authorized window is unavailable for save selection')
      }
      const selection = await dialog.showSaveDialog(window, {
        filters: [
          { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt', 'qmd'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      })
      return selection.canceled ? null : selection.filePath
    },
    inspectTarget: inspectOptionalTarget,
    saveAsSession: saveDocument.saveAs,
    rememberSession: rememberWindowSession,
    readSnapshot: readDocumentSnapshot,
    createConflictToken: randomUUID,
    rememberConflict: (record) => fileConflictsByToken.set(record.token, record)
  })
)
const filesConfirmedOverwriteRoute = defineIpcRoute(
  createFilesConfirmedOverwriteRoute({
    takeConflict: (token) => {
      const conflict = fileConflictsByToken.get(token)
      fileConflictsByToken.delete(token)
      return conflict
    },
    saveAsSession: saveDocument.saveAs,
    rememberSession: rememberWindowSession,
    readSnapshot: readDocumentSnapshot,
    createConflictToken: randomUUID,
    rememberConflict: (record) => fileConflictsByToken.set(record.token, record)
  })
)
const recoveryRoutes = createRecoveryRoutes({
  store: recoveryStore,
  findSession: (windowId, documentId) => documentSessionsByWindow.get(windowId)?.get(documentId),
  rememberSession: rememberWindowSession
}).map((route) => defineIpcRoute(route))
const router = createIpcRouter<WebContents, WebFrameMain>({
  registry: authorizedWindows,
  routes: [
    appInfoRoute,
    commandStateRoute,
    windowCloseDecisionRoute,
    filesOpenRoute,
    filesReloadExternalRoute,
    filesSaveRoute,
    filesSaveAsRoute,
    filesConfirmedOverwriteRoute,
    ...recoveryRoutes
  ],
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
registerFilesOpenIpc<IpcMainInvokeEvent>(ipcMain, {
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
registerFilesSaveIpc<IpcMainInvokeEvent>(ipcMain, {
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
registerRecoveryIpc<IpcMainInvokeEvent>(ipcMain, {
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
registerWindowLifecycleIpc<IpcMainInvokeEvent>(ipcMain, {
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
  documentSessionsByWindow.set(window.id, new Map<string, DocumentSession>())
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
    windowsAuthorizedToClose.delete(window.id)
    windowsAwaitingCloseDecision.delete(window.id)
    documentSessionsByWindow.delete(window.id)
    void fileWatcherManager.closeWindow(window.id)
    for (const [token, conflict] of fileConflictsByToken) {
      if (conflict.windowId === window.id) fileConflictsByToken.delete(token)
    }
    applicationMenu.removeWindow(window.id)
    unregister()
  }
  window.on('focus', applicationMenu.applyForFocusedWindow)
  window.on('blur', applicationMenu.applyForFocusedWindow)
  window.on('close', (event) => {
    if (windowsAuthorizedToClose.delete(window.id)) return
    event.preventDefault()
    if (windowsAwaitingCloseDecision.has(window.id) || window.webContents.isDestroyed()) return
    windowsAwaitingCloseDecision.add(window.id)
    window.webContents.send(
      WINDOW_CLOSE_REQUESTED_EVENT,
      windowCloseRequestedEventSchema.parse({ contractVersion: 1 })
    )
  })
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
