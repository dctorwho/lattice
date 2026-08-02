import { describe, expect, it, vi } from 'vitest'

import {
  CommandRegistry,
  createFoundationCommands,
  type AppCommand,
  type CommandContext,
  type CommandExecutionContext,
  type CommandId,
  type CommandState
} from '../../../src/domain/commands'

function createContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    isSidebarVisible: true,
    isDialogOpen: false,
    isWindowFocused: true,
    hasSession: false,
    isSessionDirty: false,
    hasEditor: false,
    ...overrides
  }
}

function createExecutionContext(
  overrides: Partial<CommandExecutionContext> = {}
): CommandExecutionContext {
  return {
    ...createContext(),
    toggleSidebar: vi.fn(),
    openAbout: vi.fn(() => Promise.resolve()),
    ...overrides
  }
}

function createCommand(id: CommandId, state: CommandState, run: AppCommand['run']): AppCommand {
  return {
    id,
    labelKey: id === 'app.about' ? 'commands.app.about' : 'commands.view.toggleSidebar',
    defaultShortcut: id === 'app.about' ? 'F1' : 'CommandOrControl+Shift+L',
    getState: () => state,
    run
  }
}

describe('CommandRegistry', () => {
  it('rejects duplicate command IDs before any command can execute', () => {
    const command = createCommand(
      'app.about',
      { id: 'app.about', isVisible: true, isEnabled: true, isChecked: false },
      () => Promise.resolve({ status: 'executed' })
    )

    expect(() => new CommandRegistry([command, command])).toThrow('Duplicate command ID: app.about')
  })

  it('returns a stable ID-sorted snapshot derived from the current context', () => {
    const registry = new CommandRegistry(createFoundationCommands())

    expect(registry.getStates(createContext({ isSidebarVisible: false }))).toEqual([
      { id: 'app.about', isVisible: true, isEnabled: true, isChecked: false },
      { id: 'view.toggleSidebar', isVisible: true, isEnabled: true, isChecked: false }
    ])
    expect(registry.getStates(createContext({ isSidebarVisible: true }))[1]).toEqual({
      id: 'view.toggleSidebar',
      isVisible: true,
      isEnabled: true,
      isChecked: true
    })
  })

  it('does not call a handler for an unknown command ID', async () => {
    const run = vi.fn(() => Promise.resolve({ status: 'executed' } as const))
    const registry = new CommandRegistry([
      createCommand(
        'app.about',
        { id: 'app.about', isVisible: true, isEnabled: true, isChecked: false },
        run
      )
    ])

    await expect(registry.execute('files.open', createExecutionContext())).resolves.toEqual({
      status: 'not-found',
      id: 'files.open'
    })
    expect(run).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'invisible',
      state: { id: 'app.about', isVisible: false, isEnabled: true, isChecked: false } as const,
      result: { status: 'not-visible', id: 'app.about' } as const
    },
    {
      name: 'disabled',
      state: { id: 'app.about', isVisible: true, isEnabled: false, isChecked: false } as const,
      result: { status: 'disabled', id: 'app.about' } as const
    }
  ])('does not execute an $name command', async ({ state, result }) => {
    const run = vi.fn(() => Promise.resolve({ status: 'executed' } as const))
    const registry = new CommandRegistry([createCommand('app.about', state, run)])

    await expect(registry.execute('app.about', createExecutionContext())).resolves.toEqual(result)
    expect(run).not.toHaveBeenCalled()
  })

  it('returns the asynchronous command result', async () => {
    const registry = new CommandRegistry(createFoundationCommands())
    const toggleSidebar = vi.fn()

    await expect(
      registry.execute('view.toggleSidebar', createExecutionContext({ toggleSidebar }))
    ).resolves.toEqual({ status: 'executed' })
    expect(toggleSidebar).toHaveBeenCalledOnce()
  })

  it('converts an unknown handler exception into a safe failure', async () => {
    const registry = new CommandRegistry([
      createCommand(
        'app.about',
        { id: 'app.about', isVisible: true, isEnabled: true, isChecked: false },
        () => Promise.reject(new Error('D:\\private\\draft.md'))
      )
    ])

    await expect(registry.execute('app.about', createExecutionContext())).resolves.toEqual({
      status: 'failed',
      id: 'app.about',
      messageKey: 'errors.internal.unexpected'
    })
  })
})

describe('M0 foundation command state', () => {
  const registry = new CommandRegistry(createFoundationCommands())

  it.each([
    { hasSession: false, isSessionDirty: false, hasEditor: false },
    { hasSession: true, isSessionDirty: false, hasEditor: false },
    { hasSession: true, isSessionDirty: true, hasEditor: false },
    { hasSession: true, isSessionDirty: false, hasEditor: true }
  ])('does not invent session or editor restrictions for %o', (sessionState) => {
    expect(registry.getStates(createContext(sessionState))).toEqual([
      { id: 'app.about', isVisible: true, isEnabled: true, isChecked: false },
      { id: 'view.toggleSidebar', isVisible: true, isEnabled: true, isChecked: true }
    ])
  })

  it('disables background commands while the About dialog is open', () => {
    expect(registry.getStates(createContext({ isDialogOpen: true }))).toEqual([
      { id: 'app.about', isVisible: true, isEnabled: false, isChecked: false },
      { id: 'view.toggleSidebar', isVisible: true, isEnabled: false, isChecked: true }
    ])
  })

  it('disables sidebar keyboard behavior when the window is unfocused', () => {
    expect(registry.getStates(createContext({ isWindowFocused: false }))[1]).toEqual({
      id: 'view.toggleSidebar',
      isVisible: true,
      isEnabled: false,
      isChecked: true
    })
  })

  it('defines only the two working M0 shortcuts', () => {
    expect(
      createFoundationCommands().map(({ id, defaultShortcut }) => ({ id, defaultShortcut }))
    ).toEqual([
      { id: 'view.toggleSidebar', defaultShortcut: 'CommandOrControl+Shift+L' },
      { id: 'app.about', defaultShortcut: 'F1' }
    ])
  })
})
