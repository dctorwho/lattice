import { createServer } from 'node:http'

import { _electron as electron, expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

const eligibleUrls = [
  'https://example.com/path?q=1',
  'mailto:editor@example.com?subject=Lattice'
] as const

const deniedUrls = [
  'http://example.com',
  'file:///C:/Windows/System32/calc.exe',
  'javascript:globalThis.__latticeExecuted=true',
  'data:text/html,<script>globalThis.__latticeExecuted=true</script>',
  'custom://example',
  '%6a%61vascript:alert(1)',
  'https://user:secret@example.com'
] as const

function productionLaunchEnvironment(): Record<string, string> {
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete environment.ELECTRON_RENDERER_URL
  return environment
}

async function clickAnchor(page: Page, url: string, target: '_blank' | '_self'): Promise<void> {
  await page.evaluate(
    ({ href, anchorTarget }) => {
      const anchor = document.createElement('a')
      anchor.setAttribute('href', href)
      anchor.setAttribute('target', anchorTarget)
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
    },
    { href: url, anchorTarget: target }
  )
}

async function settleMainProcess(application: ElectronApplication): Promise<void> {
  await application.evaluate(async () => {
    await new Promise<void>((resolve) => {
      setImmediate(resolve)
    })
  })
}

test('TC-M0-004 enforces navigation, external-open, CSP, permission, and DevTools policy', async () => {
  test.setTimeout(60_000)

  let requestCount = 0
  const redirectServer = createServer((_request, response) => {
    requestCount += 1
    response.writeHead(302, { Location: 'https://example.com/final' })
    response.end()
  })

  try {
    await new Promise<void>((resolve, reject) => {
      redirectServer.once('error', reject)
      redirectServer.listen(0, '127.0.0.1', () => {
        redirectServer.off('error', reject)
        resolve()
      })
    })

    const address = redirectServer.address()
    if (address === null || typeof address === 'string') {
      throw new Error('Expected a loopback TCP address')
    }
    const redirectUrl = `http://127.0.0.1:${address.port}/start`

    const application = await electron.launch({
      args: ['.'],
      env: productionLaunchEnvironment()
    })

    try {
      const page = await application.firstWindow()
      await page.waitForURL((url) => url.protocol === 'file:', {
        waitUntil: 'commit',
        timeout: 5_000
      })
      const originalUrl = page.url()

      const instrumentation = await application.evaluateHandle((electronApi) => {
        const openedUrls: string[] = []
        let confirmed = false
        let confirmationCount = 0

        const messageBoxReplacement = async () => {
          await Promise.resolve()
          confirmationCount += 1
          return {
            response: confirmed ? 0 : 1,
            checkboxChecked: false
          }
        }
        const openExternalReplacement = async (url: string) => {
          await Promise.resolve()
          openedUrls.push(new URL(url).href)
        }

        if (!Reflect.set(electronApi.dialog, 'showMessageBox', messageBoxReplacement)) {
          throw new Error('Could not replace dialog.showMessageBox')
        }
        if (!Reflect.set(electronApi.shell, 'openExternal', openExternalReplacement)) {
          throw new Error('Could not replace shell.openExternal')
        }

        return {
          setConfirmed(value: boolean): void {
            confirmed = value
          },
          clearOpenedUrls(): void {
            openedUrls.length = 0
          },
          readState(): {
            readonly confirmationCount: number
            readonly openedUrls: readonly string[]
          } {
            return {
              confirmationCount,
              openedUrls: [...openedUrls]
            }
          }
        }
      })

      try {
        for (const eligibleUrl of eligibleUrls) {
          await instrumentation.evaluate((state) => {
            state.setConfirmed(true)
          })
          const before = await instrumentation.evaluate((state) => state.readState())

          await clickAnchor(page, eligibleUrl, '_blank')

          const normalizedUrl = new URL(eligibleUrl).href
          await expect
            .poll(
              async () => {
                const state = await instrumentation.evaluate((value) => value.readState())
                return state.openedUrls.includes(normalizedUrl)
              },
              { intervals: [25, 50, 100], timeout: 3_000 }
            )
            .toBe(true)
          const after = await instrumentation.evaluate((state) => state.readState())
          expect(after.confirmationCount).toBe(before.confirmationCount + 1)
          expect(page.url()).toBe(originalUrl)
          expect(application.windows()).toHaveLength(1)
        }

        for (const eligibleUrl of eligibleUrls) {
          await instrumentation.evaluate((state) => {
            state.setConfirmed(false)
          })
          const before = await instrumentation.evaluate((state) => state.readState())

          await clickAnchor(page, eligibleUrl, '_blank')

          await expect
            .poll(
              async () => {
                const state = await instrumentation.evaluate((value) => value.readState())
                return state.confirmationCount
              },
              { intervals: [25, 50, 100], timeout: 3_000 }
            )
            .toBe(before.confirmationCount + 1)
          const after = await instrumentation.evaluate((state) => state.readState())
          expect(after.openedUrls).toEqual(before.openedUrls)
          expect(page.url()).toBe(originalUrl)
          expect(application.windows()).toHaveLength(1)
        }

        await instrumentation.evaluate((state) => {
          state.clearOpenedUrls()
          state.setConfirmed(true)
        })
        await page.evaluate(() => {
          Reflect.deleteProperty(globalThis, '__latticeExecuted')
        })

        for (const deniedUrl of deniedUrls) {
          for (const target of ['_blank', '_self'] as const) {
            await clickAnchor(page, deniedUrl, target)
            await settleMainProcess(application)

            const state = await instrumentation.evaluate((value) => value.readState())
            expect(state.openedUrls).toEqual([])
            expect(application.windows()).toHaveLength(1)
            expect(page.url()).toBe(originalUrl)
            expect(await page.evaluate(() => Reflect.has(globalThis, '__latticeExecuted'))).toBe(
              false
            )
          }
        }

        await clickAnchor(page, redirectUrl, '_self')
        await settleMainProcess(application)

        expect(requestCount).toBe(0)
        expect(await instrumentation.evaluate((state) => state.readState().openedUrls)).toEqual([])
        expect(page.url()).toBe(originalUrl)
        expect(application.windows()).toHaveLength(1)

        await page.evaluate(() => {
          Reflect.deleteProperty(globalThis, '__latticeInlineScript')
          const script = document.createElement('script')
          script.textContent = "Reflect.set(globalThis, '__latticeInlineScript', true)"
          document.head.append(script)
          script.remove()
        })
        expect(await page.evaluate(() => Reflect.has(globalThis, '__latticeInlineScript'))).toBe(
          false
        )

        const permission = await page.evaluate(async () => Notification.requestPermission())
        expect(permission).toBe('denied')

        const fetchOutcome = await page.evaluate(async () => {
          try {
            await fetch('https://example.com')
            return 'resolved'
          } catch {
            return 'rejected'
          }
        })
        expect(fetchOutcome).toBe('rejected')

        const devTools = await application.evaluate(async (electronApi) => {
          function readProperty(target: unknown, property: string): unknown {
            if ((typeof target !== 'object' && typeof target !== 'function') || target === null) {
              return undefined
            }
            return Reflect.get(target, property)
          }

          const windows = electronApi.BrowserWindow.getAllWindows()
          if (windows.length !== 1) throw new Error('Expected exactly one main window')
          const mainWindow = windows[0]
          if (mainWindow === undefined) throw new Error('Main window is missing')
          const webContents = mainWindow.webContents

          webContents.openDevTools()
          await new Promise<void>((resolve) => {
            setImmediate(resolve)
          })

          const getLastWebPreferences = readProperty(webContents, 'getLastWebPreferences')
          if (typeof getLastWebPreferences !== 'function') {
            throw new Error('Expected webContents.getLastWebPreferences')
          }
          const preferences: unknown = Reflect.apply(getLastWebPreferences, webContents, [])
          const preference = readProperty(preferences, 'devTools')

          return {
            isOpened: webContents.isDevToolsOpened(),
            preference: typeof preference === 'boolean' ? preference : null
          }
        })

        expect(devTools.isOpened).toBe(false)
        // Electron 43 omits an explicitly false devTools field from this diagnostic object.
        expect(devTools.preference).not.toBe(true)
        expect(application.windows()).toHaveLength(1)

        const isPackaged = await application.evaluate((electronApi) => electronApi.app.isPackaged)
        expect(isPackaged).toBe(false)
      } finally {
        await instrumentation.dispose()
      }
    } finally {
      await application.close()
    }
  } finally {
    if (redirectServer.listening) {
      await new Promise<void>((resolve, reject) => {
        redirectServer.close((error) => {
          if (error === undefined) resolve()
          else reject(error)
        })
      })
    }
  }
})
