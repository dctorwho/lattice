import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { ChildProcess } from 'node:child_process'

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

const negativeObservationMilliseconds = 250
const cleanupTimeoutMilliseconds = 3_000

type BoundedOutcome<T> =
  { readonly kind: 'settled'; readonly value: T } | { readonly kind: 'timed-out' }

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

async function observeFor(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      clearTimeout(timer)
      resolve()
    }, milliseconds)
  })
}

async function settleWithin<T>(
  promise: Promise<T>,
  timeoutMilliseconds: number
): Promise<BoundedOutcome<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<{ readonly kind: 'timed-out' }>((resolve) => {
    timer = setTimeout(() => {
      resolve({ kind: 'timed-out' })
    }, timeoutMilliseconds)
  })

  try {
    return await Promise.race([
      promise.then((value) => ({ kind: 'settled' as const, value })),
      timeout
    ])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

async function waitForChildExit(
  childProcess: ChildProcess,
  timeoutMilliseconds: number
): Promise<boolean> {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) return true

  return await new Promise<boolean>((resolve) => {
    let settled = false

    const finish = (didExit: boolean): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      childProcess.off('exit', onExit)
      resolve(didExit)
    }
    const onExit = (): void => {
      finish(true)
    }
    const timer = setTimeout(() => {
      finish(false)
    }, timeoutMilliseconds)

    childProcess.once('exit', onExit)
    if (childProcess.exitCode !== null || childProcess.signalCode !== null) finish(true)
  })
}

async function closeApplicationWithin(
  application: ElectronApplication,
  timeoutMilliseconds: number
): Promise<void> {
  const childProcess = application.process()
  let closeFailure: unknown
  let closeRejected = false

  try {
    const outcome = await settleWithin(application.close(), timeoutMilliseconds)
    if (outcome.kind === 'settled') return
  } catch (error) {
    closeFailure = error
    closeRejected = true
  }

  childProcess.kill('SIGKILL')
  const didExit = await waitForChildExit(childProcess, timeoutMilliseconds)
  if (!didExit) {
    throw new Error('Electron child process did not exit after forced termination')
  }
  if (closeRejected) throw closeFailure
  throw new Error('Electron application close timed out; child process was force-terminated')
}

async function closeServerWithin(server: Server, timeoutMilliseconds: number): Promise<void> {
  server.closeIdleConnections()
  server.closeAllConnections()
  if (!server.listening) return

  const close = new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve()
      else reject(error)
    })
  })
  const outcome = await settleWithin(close, timeoutMilliseconds)
  if (outcome.kind === 'timed-out') {
    server.closeAllConnections()
    throw new Error('Loopback HTTP server close timed out')
  }
}

test('TC-M0-004 enforces navigation, external-open, CSP, permission, and DevTools policy', async () => {
  test.setTimeout(60_000)

  let redirectRequestCount = 0
  let cspFetchRequestCount = 0
  const loopbackServer = createServer((request, response) => {
    if (request.url === '/redirect') {
      redirectRequestCount += 1
      response.writeHead(302, { Location: 'https://example.com/final' })
      response.end()
      return
    }

    if (request.url === '/csp-fetch') {
      cspFetchRequestCount += 1
      response.writeHead(request.method === 'OPTIONS' ? 204 : 200, {
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Private-Network': 'true',
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8'
      })
      response.end(request.method === 'OPTIONS' ? undefined : 'loopback endpoint reached')
      return
    }

    response.writeHead(404)
    response.end()
  })

  try {
    await new Promise<void>((resolve, reject) => {
      loopbackServer.once('error', reject)
      loopbackServer.listen(0, '127.0.0.1', () => {
        loopbackServer.off('error', reject)
        resolve()
      })
    })

    const address = loopbackServer.address()
    if (address === null || typeof address === 'string') {
      throw new Error('Expected a loopback TCP address')
    }
    const redirectUrl = `http://127.0.0.1:${address.port}/redirect`
    const cspFetchUrl = `http://127.0.0.1:${address.port}/csp-fetch`

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
        await observeFor(negativeObservationMilliseconds)

        expect(redirectRequestCount).toBe(0)
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

        const fetchOutcome = await page.evaluate(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-store' })
            return response.ok ? 'resolved' : 'non-ok'
          } catch {
            return 'rejected'
          }
        }, cspFetchUrl)
        expect(fetchOutcome).toBe('rejected')
        await observeFor(negativeObservationMilliseconds)
        expect(cspFetchRequestCount).toBe(0)

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

          const observedOpen = await new Promise<boolean>((resolve, reject) => {
            let settled = false
            const finish = (didOpen: boolean): void => {
              if (settled) return
              settled = true
              clearTimeout(timer)
              webContents.off('devtools-opened', onDevToolsOpened)
              resolve(didOpen)
            }
            const onDevToolsOpened = (): void => {
              finish(true)
            }
            const timer = setTimeout(() => {
              finish(false)
            }, 500)

            webContents.once('devtools-opened', onDevToolsOpened)
            try {
              webContents.openDevTools()
            } catch (error) {
              clearTimeout(timer)
              webContents.off('devtools-opened', onDevToolsOpened)
              reject(
                error instanceof Error
                  ? error
                  : new Error('webContents.openDevTools failed', { cause: error })
              )
            }
          })

          const getLastWebPreferences = readProperty(webContents, 'getLastWebPreferences')
          if (typeof getLastWebPreferences !== 'function') {
            throw new Error('Expected webContents.getLastWebPreferences')
          }
          const preferences: unknown = Reflect.apply(getLastWebPreferences, webContents, [])
          const preference = readProperty(preferences, 'devTools')

          return {
            isOpened: webContents.isDevToolsOpened(),
            observedOpen,
            preference: typeof preference === 'boolean' ? preference : null
          }
        })

        expect(devTools.observedOpen).toBe(false)
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
      await closeApplicationWithin(application, cleanupTimeoutMilliseconds)
    }
  } finally {
    await closeServerWithin(loopbackServer, cleanupTimeoutMilliseconds)
  }
})
