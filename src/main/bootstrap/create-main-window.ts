import { BrowserWindow } from 'electron'
import { join } from 'node:path'

export interface CreateMainWindowOptions {
  readonly currentDirectory: string
  readonly developmentRendererUrl?: string
}

export function createMainWindow(options: CreateMainWindowOptions): BrowserWindow {
  const development = options.developmentRendererUrl !== undefined
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    show: true,
    webPreferences: {
      preload: join(options.currentDirectory, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false,
      devTools: development
    }
  })

  if (options.developmentRendererUrl === undefined) {
    void window.loadFile(join(options.currentDirectory, '../renderer/index.html'))
  } else {
    void window.loadURL(options.developmentRendererUrl)
  }
  return window
}
