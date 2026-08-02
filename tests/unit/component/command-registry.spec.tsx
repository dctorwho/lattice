import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CommandRegistry } from '../../../src/domain/commands'
import { App } from '../../../src/renderer/src/app'
import type { CommandId, LatticeDesktopApi } from '../../../src/shared/contracts'

const appInfo = {
  contractVersion: 1,
  name: 'Lattice',
  version: '0.0.0',
  platform: 'win32'
} as const

interface PreloadHarness {
  readonly api: LatticeDesktopApi
  readonly updateStates: ReturnType<typeof vi.fn<LatticeDesktopApi['commands']['updateStates']>>
  readonly emitCommand: (id: CommandId) => void
}

function createPreloadHarness(
  getInfo: LatticeDesktopApi['app']['getInfo'] = () => Promise.resolve({ ok: true, value: appInfo })
): PreloadHarness {
  let listener: ((id: CommandId) => void) | undefined
  const updateStates = vi.fn<LatticeDesktopApi['commands']['updateStates']>(() =>
    Promise.resolve({ ok: true, value: { contractVersion: 1, applied: true } })
  )
  const api: LatticeDesktopApi = Object.freeze({
    app: Object.freeze({ getInfo }),
    commands: Object.freeze({
      onInvoke: (nextListener: (id: CommandId) => void) => {
        listener = nextListener
        return () => {
          if (listener === nextListener) listener = undefined
        }
      },
      updateStates
    })
  })

  return {
    api,
    updateStates,
    emitCommand: (id) => {
      if (listener === undefined) throw new Error('Command listener is not registered')
      listener(id)
    }
  }
}

function installPreload(harness: PreloadHarness): void {
  Object.defineProperty(window, 'lattice', {
    configurable: true,
    value: harness.api
  })
}

function sidebar(): HTMLElement | null {
  return screen.queryByRole('complementary', { name: '侧栏' })
}

describe('TC-M0-006 command shell', () => {
  beforeEach(() => {
    installPreload(createPreloadHarness())
  })

  afterEach(() => {
    Reflect.deleteProperty(window, 'lattice')
    vi.restoreAllMocks()
  })

  it('uses view.toggleSidebar for the title-area command button', () => {
    const execute = vi.spyOn(CommandRegistry.prototype, 'execute')
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '切换侧栏' }))

    expect(sidebar()).not.toBeInTheDocument()
    expect(execute).toHaveBeenCalledWith('view.toggleSidebar', expect.any(Object))
  })

  it('uses view.toggleSidebar for a validated native-menu event', async () => {
    const harness = createPreloadHarness()
    installPreload(harness)
    const execute = vi.spyOn(CommandRegistry.prototype, 'execute')
    render(<App />)

    harness.emitCommand('view.toggleSidebar')

    await waitFor(() => expect(sidebar()).not.toBeInTheDocument())
    expect(execute).toHaveBeenCalledWith('view.toggleSidebar', expect.any(Object))
  })

  it('uses view.toggleSidebar for the keyboard shortcut and restores main focus', async () => {
    const execute = vi.spyOn(CommandRegistry.prototype, 'execute')
    render(<App />)
    const currentSidebar = screen.getByRole('complementary', { name: '侧栏' })
    currentSidebar.focus()
    expect(currentSidebar).toHaveFocus()

    fireEvent.keyDown(window, { key: 'l', code: 'KeyL', ctrlKey: true, shiftKey: true })

    await waitFor(() => expect(sidebar()).not.toBeInTheDocument())
    expect(screen.getByRole('main')).toHaveFocus()
    expect(execute).toHaveBeenCalledWith('view.toggleSidebar', expect.any(Object))
  })

  it('uses view.toggleSidebar for the renderer context menu', async () => {
    const execute = vi.spyOn(CommandRegistry.prototype, 'execute')
    render(<App />)
    const main = screen.getByRole('main')

    fireEvent.contextMenu(main, { clientX: 24, clientY: 36 })
    const menu = screen.getByRole('menu', { name: '命令菜单' })
    expect(menu).toBeVisible()
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: '切换侧栏' }))

    await waitFor(() => expect(sidebar()).not.toBeInTheDocument())
    expect(execute).toHaveBeenCalledWith('view.toggleSidebar', expect.any(Object))
  })

  it('opens About with real AppInfo and restores the button focus on close', async () => {
    const aboutButton = '关于 Lattice'
    render(<App />)
    const trigger = screen.getByRole('button', { name: aboutButton })

    fireEvent.click(trigger)

    const dialog = await screen.findByRole('dialog', { name: aboutButton })
    expect(dialog).toBeVisible()
    expect(screen.getByText('0.0.0')).toBeVisible()
    expect(screen.getByText('win32')).toBeVisible()
    expect(screen.getByText('1')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))

    await waitFor(() => expect(dialog).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })

  it('shows a localized stable error without leaking raw About failure details', async () => {
    installPreload(
      createPreloadHarness(() =>
        Promise.resolve({
          ok: false,
          error: {
            code: 'INTERNAL_UNEXPECTED',
            messageKey: 'errors.internal.unexpected',
            retryable: false,
            safeDetails: { reason: 'handler_threw' },
            requestId: '00000000-0000-4000-8000-000000000001'
          }
        })
      )
    )
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: '关于 Lattice' }))

    expect(await screen.findByText('发生了意外错误。')).toBeVisible()
    expect(screen.queryByText(/handler_threw|00000000/u)).not.toBeInTheDocument()
  })

  it('closes the context menu with Escape and restores the invocation target', async () => {
    render(<App />)
    const main = screen.getByRole('main')
    main.focus()
    fireEvent.contextMenu(main, { clientX: 24, clientY: 36 })
    expect(screen.getByRole('menu', { name: '命令菜单' })).toBeVisible()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(main).toHaveFocus()
  })

  it('does not execute a renderer shortcut while the window is unfocused', () => {
    const execute = vi.spyOn(CommandRegistry.prototype, 'execute')
    render(<App />)
    fireEvent.blur(window)

    fireEvent.keyDown(window, { key: 'l', code: 'KeyL', ctrlKey: true, shiftKey: true })

    expect(sidebar()).toBeVisible()
    expect(execute).not.toHaveBeenCalledWith('view.toggleSidebar', expect.any(Object))
  })

  it('synchronizes both command states without recursive retries', async () => {
    const harness = createPreloadHarness()
    installPreload(harness)
    render(<App />)

    await waitFor(() => expect(harness.updateStates).toHaveBeenCalled())
    const latestStates = harness.updateStates.mock.calls.at(-1)?.[0]
    expect(latestStates).toEqual([
      { id: 'app.about', isVisible: true, isEnabled: true, isChecked: false },
      { id: 'view.toggleSidebar', isVisible: true, isEnabled: true, isChecked: true }
    ])
  })
})
