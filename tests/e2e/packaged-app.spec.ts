import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

function productionLaunchEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete environment.ELECTRON_RENDERER_URL
  return environment
}

test('TC-M0-007 launches the packaged executable with the frozen production boundary', async () => {
  const executablePath = resolve('dist', 'win-unpacked', 'Lattice.exe')
  const appAsarPath = resolve('dist', 'win-unpacked', 'resources', 'app.asar')
  expect((await stat(executablePath)).isFile()).toBe(true)
  expect((await stat(appAsarPath)).isFile()).toBe(true)

  const application = await electron.launch({
    executablePath,
    env: productionLaunchEnvironment()
  })
  try {
    const page = await application.firstWindow()
    await page.waitForURL((url) => url.protocol === 'file:', { waitUntil: 'commit' })
    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible()

    const runtime = await application.evaluate(async (electronApi) => {
      const windows = electronApi.BrowserWindow.getAllWindows()
      const mainWindow = windows[0]
      if (mainWindow === undefined) throw new Error('Expected the packaged main window')
      mainWindow.webContents.openDevTools({ mode: 'detach' })
      await new Promise<void>((resolveDelay) => {
        setTimeout(resolveDelay, 50)
      })
      return {
        isPackaged: electronApi.app.isPackaged,
        appPath: electronApi.app.getAppPath(),
        resourcesPath: process.resourcesPath,
        devToolsOpened: mainWindow.webContents.isDevToolsOpened(),
        argv: process.argv,
        rendererUrl: process.env.ELECTRON_RENDERER_URL
      }
    })

    expect(runtime.isPackaged).toBe(true)
    expect(runtime.appPath.replaceAll('\\', '/')).toMatch(/\/resources\/app\.asar$/)
    expect(runtime.resourcesPath.replaceAll('\\', '/')).toMatch(/\/win-unpacked\/resources$/)
    expect(runtime.devToolsOpened).toBe(false)
    expect(runtime.argv).toEqual([executablePath, '--inspect=0', '--remote-debugging-port=0'])
    expect(runtime.rendererUrl).toBeUndefined()

    const boundary = await page.evaluate(() => {
      const lattice: unknown = Reflect.get(globalThis, 'lattice')
      if (typeof lattice !== 'object' || lattice === null) {
        throw new Error('Expected the packaged preload surface')
      }
      const app: unknown = Reflect.get(lattice, 'app')
      const commands: unknown = Reflect.get(lattice, 'commands')
      if (
        typeof app !== 'object' ||
        app === null ||
        typeof commands !== 'object' ||
        commands === null
      ) {
        throw new Error('Expected the packaged app and command surfaces')
      }
      return {
        url: location.href,
        latticeKeys: Object.keys(lattice),
        appKeys: Object.keys(app),
        commandKeys: Object.keys(commands),
        frozen: [Object.isFrozen(lattice), Object.isFrozen(app), Object.isFrozen(commands)],
        globals: Object.fromEntries(
          ['require', 'process', 'electron', 'ipcRenderer', 'fs', 'shell'].map((name) => [
            name,
            typeof Reflect.get(globalThis, name)
          ])
        )
      }
    })

    expect(new URL(boundary.url).protocol).toBe('file:')
    expect(boundary).toMatchObject({
      latticeKeys: ['app', 'commands'],
      appKeys: ['getInfo'],
      commandKeys: ['onInvoke', 'updateStates'],
      frozen: [true, true, true],
      globals: {
        require: 'undefined',
        process: 'undefined',
        electron: 'undefined',
        ipcRenderer: 'undefined',
        fs: 'undefined',
        shell: 'undefined'
      }
    })
  } finally {
    await application.close()
  }
})
