import { _electron as electron, expect, test } from '@playwright/test'

function productionLaunchEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete environment.ELECTRON_RENDERER_URL
  return environment
}

test('TC-M0-003 denies renderer privileges and preserves the global sandbox boundary', async () => {
  const application = await electron.launch({ args: ['.'], env: productionLaunchEnvironment() })
  try {
    const page = await application.firstWindow()
    await page.waitForURL((url) => url.protocol === 'file:', { waitUntil: 'commit' })
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
      if (!Array.isArray(windows) || windows.length !== 1) {
        throw new Error('Expected exactly one main window')
      }
      const mainWindow = readProperty(windows, '0')
      if (mainWindow === undefined) throw new Error('Main window is missing')
      const webContents = readProperty(mainWindow, 'webContents')
      const values = invokeWithoutArgs(webContents, 'getLastWebPreferences')

      return {
        sandbox: readBooleanProperty(values, 'sandbox'),
        contextIsolation: readBooleanProperty(values, 'contextIsolation'),
        nodeIntegration: readBooleanProperty(values, 'nodeIntegration'),
        nodeIntegrationInSubFrames: readBooleanProperty(values, 'nodeIntegrationInSubFrames'),
        webSecurity: readBooleanProperty(values, 'webSecurity'),
        allowRunningInsecureContent: readBooleanProperty(values, 'allowRunningInsecureContent'),
        experimentalFeatures: readBooleanProperty(values, 'experimentalFeatures'),
        webviewTag: readBooleanProperty(values, 'webviewTag')
      }
    })

    expect(new URL(page.url()).protocol).toBe('file:')
    expect(preferences).toEqual({
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      webviewTag: false
    })

    const globals = await page.evaluate(() => {
      const names = ['require', 'process', 'electron', 'ipcRenderer', 'fs', 'shell'] as const
      return Object.fromEntries(names.map((name) => [name, typeof Reflect.get(globalThis, name)]))
    })

    expect(globals).toEqual({
      require: 'undefined',
      process: 'undefined',
      electron: 'undefined',
      ipcRenderer: 'undefined',
      fs: 'undefined',
      shell: 'undefined'
    })

    const preloadSurface = await page.evaluate(async () => {
      const lattice: unknown = Reflect.get(globalThis, 'lattice')
      if (typeof lattice !== 'object' || lattice === null) {
        throw new Error('Expected the approved lattice preload surface')
      }
      const app: unknown = Reflect.get(lattice, 'app')
      if (typeof app !== 'object' || app === null) {
        throw new Error('Expected the approved app preload surface')
      }
      const getInfo: unknown = Reflect.get(app, 'getInfo')
      if (typeof getInfo !== 'function') {
        throw new Error('Expected app.getInfo')
      }
      const commands: unknown = Reflect.get(lattice, 'commands')
      if (typeof commands !== 'object' || commands === null) {
        throw new Error('Expected the approved command preload surface')
      }
      const onInvoke: unknown = Reflect.get(commands, 'onInvoke')
      const updateStates: unknown = Reflect.get(commands, 'updateStates')
      if (typeof onInvoke !== 'function' || typeof updateStates !== 'function') {
        throw new Error('Expected approved command methods')
      }
      const result: unknown = await Reflect.apply(getInfo, app, [])
      const stateResult: unknown = await Reflect.apply(updateStates, commands, [
        [
          { id: 'app.about', isVisible: true, isEnabled: true, isChecked: false },
          { id: 'view.toggleSidebar', isVisible: true, isEnabled: true, isChecked: true }
        ]
      ])
      const unsubscribe: unknown = Reflect.apply(onInvoke, commands, [() => {}])
      if (typeof unsubscribe !== 'function') {
        throw new Error('Expected command unsubscribe function')
      }
      Reflect.apply(unsubscribe, undefined, [])
      return {
        latticeKeys: Object.keys(lattice),
        appKeys: Object.keys(app),
        commandKeys: Object.keys(commands),
        frozen: {
          lattice: Object.isFrozen(lattice),
          app: Object.isFrozen(app),
          commands: Object.isFrozen(commands)
        },
        result,
        stateResult,
        absent: {
          invoke: typeof Reflect.get(lattice, 'invoke'),
          send: typeof Reflect.get(lattice, 'send'),
          files: typeof Reflect.get(lattice, 'files'),
          exports: typeof Reflect.get(lattice, 'exports'),
          openExternal: typeof Reflect.get(app, 'openExternal'),
          commandInvoke: typeof Reflect.get(commands, 'invoke'),
          commandSend: typeof Reflect.get(commands, 'send'),
          commandOn: typeof Reflect.get(commands, 'on')
        }
      }
    })

    expect(preloadSurface).toEqual({
      latticeKeys: ['app', 'commands'],
      appKeys: ['getInfo'],
      commandKeys: ['onInvoke', 'updateStates'],
      frozen: {
        lattice: true,
        app: true,
        commands: true
      },
      result: {
        ok: true,
        value: {
          contractVersion: 1,
          name: 'Lattice',
          version: '0.0.0',
          platform: 'win32'
        }
      },
      stateResult: {
        ok: true,
        value: {
          contractVersion: 1,
          applied: true
        }
      },
      absent: {
        invoke: 'undefined',
        send: 'undefined',
        files: 'undefined',
        exports: 'undefined',
        openExternal: 'undefined',
        commandInvoke: 'undefined',
        commandSend: 'undefined',
        commandOn: 'undefined'
      }
    })

    await page.evaluate(() => {
      const lattice: unknown = Reflect.get(globalThis, 'lattice')
      if (typeof lattice !== 'object' || lattice === null) {
        throw new Error('Expected the lattice preload surface')
      }
      const commands: unknown = Reflect.get(lattice, 'commands')
      if (typeof commands !== 'object' || commands === null) {
        throw new Error('Expected the command preload surface')
      }
      const onInvoke: unknown = Reflect.get(commands, 'onInvoke')
      if (typeof onInvoke !== 'function') throw new Error('Expected commands.onInvoke')
      const received: string[] = []
      const unsubscribe: unknown = Reflect.apply(onInvoke, commands, [
        (id: string) => received.push(id)
      ])
      Reflect.set(globalThis, '__latticeInvalidCommandProbe', { received, unsubscribe })
    })
    await application.evaluate((electronApi) => {
      const windows = electronApi.BrowserWindow.getAllWindows()
      const mainWindow = windows[0]
      if (mainWindow === undefined) throw new Error('Expected the main window')
      mainWindow.webContents.send('lattice:commands:invoked', {
        contractVersion: 1,
        id: 'files.open',
        rawPath: 'D:\\private\\draft.md'
      })
    })
    await page.waitForTimeout(50)
    const invalidEventProbe = await page.evaluate(() => {
      const probe: unknown = Reflect.get(globalThis, '__latticeInvalidCommandProbe')
      if (typeof probe !== 'object' || probe === null) return ['invalid-probe-shape']
      const received: unknown = Reflect.get(probe, 'received')
      const unsubscribe: unknown = Reflect.get(probe, 'unsubscribe')
      if (typeof unsubscribe === 'function') Reflect.apply(unsubscribe, undefined, [])
      Reflect.deleteProperty(globalThis, '__latticeInvalidCommandProbe')
      return Array.isArray(received) ? received.length : -1
    })
    expect(invalidEventProbe).toBe(0)

    const fakeWindowResult = await application.evaluate(async (electronApi) => {
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
      if (typeof browserWindow !== 'function') {
        throw new Error('BrowserWindow constructor is unavailable')
      }
      const fakeWindow: unknown = Reflect.construct(browserWindow, [{ show: false }])

      try {
        const webContents = readProperty(fakeWindow, 'webContents')
        const values = invokeWithoutArgs(webContents, 'getLastWebPreferences')
        const beforeDestroy = {
          sandbox: readBooleanProperty(values, 'sandbox'),
          nodeIntegration: readBooleanProperty(values, 'nodeIntegration')
        }

        invokeWithoutArgs(fakeWindow, 'destroy')
        await new Promise<void>((resolve) => {
          setImmediate(resolve)
        })

        return {
          beforeDestroy,
          destroyed: invokeWithoutArgs(fakeWindow, 'isDestroyed')
        }
      } finally {
        const destroyed = invokeWithoutArgs(fakeWindow, 'isDestroyed')
        if (destroyed !== true) invokeWithoutArgs(fakeWindow, 'destroy')
      }
    })

    expect(fakeWindowResult.beforeDestroy.sandbox).toBe(true)
    expect(fakeWindowResult.beforeDestroy.nodeIntegration).toBe(false)
    expect(fakeWindowResult.destroyed).toBe(true)

    const hostileMessageResult = await page.evaluate(() => {
      const polluted: unknown = JSON.parse('{"__proto__":{"latticePolluted":true}}')
      globalThis.postMessage(polluted, '*')
      globalThis.postMessage({ payload: 'x'.repeat(2_100_000) }, '*')
      const prototypeValue: unknown = Reflect.get(Object.prototype, 'latticePolluted')
      return {
        prototypeValue,
        documentState: document.readyState
      }
    })

    expect(hostileMessageResult.prototypeValue).toBeUndefined()
    expect(hostileMessageResult.documentState).toBe('complete')
    expect(await page.evaluate(() => document.readyState)).toBe('complete')

    const mainWindowCount = await application.evaluate((electronApi) => {
      function readProperty(target: unknown, property: string): unknown {
        if ((typeof target !== 'object' && typeof target !== 'function') || target === null) {
          return undefined
        }
        return Reflect.get(target, property)
      }

      const browserWindow = readProperty(electronApi, 'BrowserWindow')
      const getAllWindows = readProperty(browserWindow, 'getAllWindows')
      if (typeof getAllWindows !== 'function') {
        throw new Error('BrowserWindow.getAllWindows is unavailable')
      }
      const windows: unknown = Reflect.apply(getAllWindows, browserWindow, [])
      if (!Array.isArray(windows)) throw new Error('Expected an Electron window array')
      return windows.length
    })

    expect(mainWindowCount).toBe(1)
  } finally {
    await application.close()
  }
})
