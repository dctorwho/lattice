import { describe, expect, it } from 'vitest'

import {
  composeApplication,
  type ApplicationCompositionDependencies
} from '../../../src/main/bootstrap/compose-application'

interface Deferred {
  readonly promise: Promise<void>
  readonly resolve: () => void
}

interface TestContents {
  readonly id: number
}

function createDeferred(): Deferred {
  let resolvePromise: (() => void) | undefined
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve
  })
  if (resolvePromise === undefined) throw new Error('deferred resolver was not initialized')
  return { promise, resolve: resolvePromise }
}

function createCompositionHarness(
  options: {
    readonly platform?: NodeJS.Platform
    readonly hasOpenWindows?: boolean
  } = {}
): {
  readonly dependencies: ApplicationCompositionDependencies<TestContents>
  readonly calls: string[]
  readonly ready: Deferred
  readonly getWebContentsCreatedListener: () => ((contents: TestContents) => void) | undefined
  readonly getActivateListener: () => (() => void) | undefined
  readonly getWindowAllClosedListener: () => (() => void) | undefined
} {
  const calls: string[] = []
  const ready = createDeferred()
  let webContentsCreatedListener: ((contents: TestContents) => void) | undefined
  let activateListener: (() => void) | undefined
  let windowAllClosedListener: (() => void) | undefined

  return {
    dependencies: {
      platform: options.platform ?? 'win32',
      enableSandbox: () => {
        calls.push('enable-sandbox')
      },
      registerWebContentsCreated: (listener) => {
        calls.push('register-web-contents-created')
        webContentsCreatedListener = listener
      },
      whenReady: () => {
        calls.push('when-ready')
        return ready.promise
      },
      installWebContentsSecurityPolicy: (contents) => {
        calls.push(`secure-web-contents:${contents.id}`)
      },
      installSessionSecurityPolicy: (development) => {
        calls.push(`secure-session:${development ? 'development' : 'production'}`)
      },
      createMainWindow: (mainWindowOptions) => {
        calls.push(
          mainWindowOptions.developmentRendererUrl === undefined
            ? `create-window:${mainWindowOptions.currentDirectory}:production`
            : `create-window:${mainWindowOptions.currentDirectory}:${mainWindowOptions.developmentRendererUrl}`
        )
      },
      registerActivate: (listener) => {
        calls.push('register-activate')
        activateListener = listener
      },
      hasOpenWindows: () => options.hasOpenWindows ?? false,
      registerWindowAllClosed: (listener) => {
        calls.push('register-window-all-closed')
        windowAllClosedListener = listener
      },
      quit: () => {
        calls.push('quit')
      }
    },
    calls,
    ready,
    getWebContentsCreatedListener: () => webContentsCreatedListener,
    getActivateListener: () => activateListener,
    getWindowAllClosedListener: () => windowAllClosedListener
  }
}

function requireListener<T>(listener: T | undefined, name: string): T {
  if (listener === undefined) throw new Error(`${name} was not registered`)
  return listener
}

describe('application composition', () => {
  it('SEC-001 installs sandbox and all-WebContents coverage before readiness, then secures the session before creating a production window', async () => {
    const harness = createCompositionHarness()

    composeApplication({ currentDirectory: 'C:\\application\\out\\main' }, harness.dependencies)

    expect(harness.calls).toEqual([
      'enable-sandbox',
      'register-web-contents-created',
      'when-ready',
      'register-window-all-closed'
    ])
    requireListener(
      harness.getWebContentsCreatedListener(),
      'web contents created listener'
    )({ id: 7 })
    expect(harness.calls.at(-1)).toBe('secure-web-contents:7')

    harness.ready.resolve()
    await harness.ready.promise

    expect(harness.calls.slice(-3)).toEqual([
      'secure-session:production',
      'create-window:C:\\application\\out\\main:production',
      'register-activate'
    ])
  })

  it('SEC-001 configures the development session and recreates the development window only when none remain', async () => {
    const harness = createCompositionHarness({ hasOpenWindows: false })

    composeApplication(
      {
        currentDirectory: 'C:\\application\\out\\main',
        developmentRendererUrl: 'http://127.0.0.1:5173'
      },
      harness.dependencies
    )
    harness.ready.resolve()
    await harness.ready.promise

    requireListener(harness.getActivateListener(), 'activate listener')()

    expect(harness.calls).toContain('secure-session:development')
    expect(
      harness.calls.filter(
        (call) => call === 'create-window:C:\\application\\out\\main:http://127.0.0.1:5173'
      )
    ).toHaveLength(2)
  })

  it('SEC-001 does not create another window on activation while a window remains open', async () => {
    const harness = createCompositionHarness({ hasOpenWindows: true })

    composeApplication({ currentDirectory: 'C:\\application\\out\\main' }, harness.dependencies)
    harness.ready.resolve()
    await harness.ready.promise
    requireListener(harness.getActivateListener(), 'activate listener')()

    expect(
      harness.calls.filter((call) => call === 'create-window:C:\\application\\out\\main:production')
    ).toHaveLength(1)
  })

  it.each([
    ['win32', 1],
    ['darwin', 0]
  ] as const)(
    'SEC-001 quits after the last window closes on %s only when required',
    (platform, quitCount) => {
      const harness = createCompositionHarness({ platform })

      composeApplication({ currentDirectory: 'C:\\application\\out\\main' }, harness.dependencies)
      requireListener(harness.getWindowAllClosedListener(), 'window all closed listener')()

      expect(harness.calls.filter((call) => call === 'quit')).toHaveLength(quitCount)
    }
  )
})
