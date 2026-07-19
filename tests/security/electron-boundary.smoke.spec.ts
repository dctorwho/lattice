import { _electron as electron, expect, test } from '@playwright/test'

test('M0-T02 preserves the current renderer privilege boundary', async () => {
  const application = await electron.launch({ args: ['.'] })
  try {
    const page = await application.firstWindow()
    const preferences = await application.evaluate((electronApi) => {
      function readProperty(target: unknown, property: string): unknown {
        if ((typeof target !== 'object' && typeof target !== 'function') || target === null) {
          return undefined
        }
        return Reflect.get(target, property)
      }

      function isNoArgumentFunction(value: unknown): value is () => unknown {
        return typeof value === 'function'
      }

      function invokeWithoutArgs(target: unknown, property: string): unknown {
        const method = readProperty(target, property)
        if (!isNoArgumentFunction(method)) throw new Error('Expected an Electron API method')
        return Reflect.apply(method, target, [])
      }

      function readBooleanProperty(target: unknown, property: string): boolean | undefined {
        const value = readProperty(target, property)
        return typeof value === 'boolean' ? value : undefined
      }

      const browserWindow = readProperty(electronApi, 'BrowserWindow')
      const windows = invokeWithoutArgs(browserWindow, 'getAllWindows')
      if (!Array.isArray(windows) || windows.length === 0) {
        throw new Error('Main window is missing')
      }
      const webContents = readProperty(windows[0], 'webContents')
      const values = invokeWithoutArgs(webContents, 'getLastWebPreferences')

      return {
        sandbox: readBooleanProperty(values, 'sandbox'),
        contextIsolation: readBooleanProperty(values, 'contextIsolation'),
        nodeIntegration: readBooleanProperty(values, 'nodeIntegration')
      }
    })
    const globals = await page.evaluate(() => ({
      requireType: typeof Reflect.get(globalThis, 'require'),
      processType: typeof Reflect.get(globalThis, 'process'),
      electronType: typeof Reflect.get(globalThis, 'electron')
    }))

    expect(preferences).toEqual({
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    })
    expect(globals).toEqual({
      requireType: 'undefined',
      processType: 'undefined',
      electronType: 'undefined'
    })
  } finally {
    await application.close()
  }
})
