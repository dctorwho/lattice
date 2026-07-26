import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMainWindow } from '../../../src/main/bootstrap/create-main-window'

const electronState = vi.hoisted(() => {
  const constructorOptions: unknown[] = []
  return {
    constructorOptions,
    loadFile: vi.fn(async () => {}),
    loadURL: vi.fn(async () => {})
  }
})

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {
    constructor(options: unknown) {
      electronState.constructorOptions.push(options)
    }

    loadFile = electronState.loadFile
    loadURL = electronState.loadURL
  }
}))

describe('secure main window factory', () => {
  beforeEach(() => {
    electronState.constructorOptions.length = 0
    electronState.loadFile.mockClear()
    electronState.loadURL.mockClear()
  })

  it('SEC-001 creates the production window with every privileged renderer capability disabled', () => {
    const currentDirectory = 'C:\\application\\out\\main'

    createMainWindow({ currentDirectory })

    expect(electronState.constructorOptions).toEqual([
      {
        width: 960,
        height: 640,
        show: true,
        webPreferences: {
          preload: join(currentDirectory, '../preload/index.cjs'),
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          nodeIntegrationInWorker: false,
          nodeIntegrationInSubFrames: false,
          webSecurity: true,
          allowRunningInsecureContent: false,
          experimentalFeatures: false,
          webviewTag: false,
          devTools: false
        }
      }
    ])
    expect(electronState.loadFile).toHaveBeenCalledWith(
      join(currentDirectory, '../renderer/index.html')
    )
    expect(electronState.loadURL).not.toHaveBeenCalled()
  })

  it('SEC-001 enables DevTools only when an unpackaged development renderer URL is supplied', () => {
    const currentDirectory = 'C:\\application\\out\\main'
    const developmentRendererUrl = 'http://127.0.0.1:5173'

    createMainWindow({ currentDirectory, developmentRendererUrl })

    expect(electronState.constructorOptions).toHaveLength(1)
    expect(electronState.constructorOptions[0]).toMatchObject({
      webPreferences: { devTools: true }
    })
    expect(electronState.loadURL).toHaveBeenCalledWith(developmentRendererUrl)
    expect(electronState.loadFile).not.toHaveBeenCalled()
  })
})
