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
    isSessionReadOnly: false,
    hasEditor: false,
    canUndo: false,
    canRedo: false,
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
    newDocument: vi.fn(),
    openDocument: vi.fn(),
    saveDocument: vi.fn(),
    saveDocumentAs: vi.fn(),
    closeDocument: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    openFind: vi.fn(),
    openReplace: vi.fn(),
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
    const states = registry.getStates(createContext({ isSidebarVisible: false }))

    expect(states.map(({ id }) => id)).toEqual([
      'app.about',
      'edit.find',
      'edit.redo',
      'edit.replace',
      'edit.undo',
      'file.close',
      'file.new',
      'file.open',
      'file.save',
      'file.saveAs',
      'view.toggleSidebar'
    ])
    expect(states.find(({ id }) => id === 'file.new')).toEqual({
      id: 'file.new',
      isVisible: true,
      isEnabled: true,
      isChecked: false
    })
    expect(
      registry
        .getStates(createContext({ isSidebarVisible: true }))
        .find(({ id }) => id === 'view.toggleSidebar')
    ).toEqual({
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

describe('M1 unified command state', () => {
  const registry = new CommandRegistry(createFoundationCommands())

  it('按会话、编辑器、只读和历史状态启用文档命令', () => {
    const unavailable = registry.getStates(createContext())
    expect(unavailable.find(({ id }) => id === 'file.open')?.isEnabled).toBe(true)
    expect(unavailable.find(({ id }) => id === 'file.save')?.isEnabled).toBe(false)
    expect(unavailable.find(({ id }) => id === 'edit.find')?.isEnabled).toBe(false)

    const editable = registry.getStates(
      createContext({ hasSession: true, hasEditor: true, canUndo: true, canRedo: true })
    )
    expect(editable.find(({ id }) => id === 'file.save')?.isEnabled).toBe(true)
    expect(editable.find(({ id }) => id === 'file.saveAs')?.isEnabled).toBe(true)
    expect(editable.find(({ id }) => id === 'edit.undo')?.isEnabled).toBe(true)
    expect(editable.find(({ id }) => id === 'edit.redo')?.isEnabled).toBe(true)

    const readOnly = registry.getStates(
      createContext({ hasSession: true, hasEditor: true, isSessionReadOnly: true })
    )
    expect(readOnly.find(({ id }) => id === 'file.save')?.isEnabled).toBe(false)
    expect(readOnly.find(({ id }) => id === 'file.saveAs')?.isEnabled).toBe(true)
  })

  it('disables background commands while the About dialog is open', () => {
    expect(
      registry.getStates(createContext({ isDialogOpen: true })).every((state) => !state.isEnabled)
    ).toBe(true)
  })

  it('disables sidebar keyboard behavior when the window is unfocused', () => {
    expect(
      registry
        .getStates(createContext({ isWindowFocused: false }))
        .find(({ id }) => id === 'view.toggleSidebar')
    ).toEqual({
      id: 'view.toggleSidebar',
      isVisible: true,
      isEnabled: false,
      isChecked: true
    })
  })

  it('defines the exact working M1 shortcuts', () => {
    expect(
      createFoundationCommands().map(({ id, defaultShortcut }) => ({ id, defaultShortcut }))
    ).toEqual([
      { id: 'file.new', defaultShortcut: 'CommandOrControl+N' },
      { id: 'file.open', defaultShortcut: 'CommandOrControl+O' },
      { id: 'file.save', defaultShortcut: 'CommandOrControl+S' },
      { id: 'file.saveAs', defaultShortcut: 'CommandOrControl+Shift+S' },
      { id: 'file.close', defaultShortcut: 'CommandOrControl+W' },
      { id: 'edit.undo', defaultShortcut: 'CommandOrControl+Z' },
      { id: 'edit.redo', defaultShortcut: 'CommandOrControl+Y' },
      { id: 'edit.find', defaultShortcut: 'CommandOrControl+F' },
      { id: 'edit.replace', defaultShortcut: 'CommandOrControl+H' },
      { id: 'view.toggleSidebar', defaultShortcut: 'CommandOrControl+Shift+L' },
      { id: 'app.about', defaultShortcut: 'F1' }
    ])
  })

  it('executes the shared file-save command through the supplied document binding', async () => {
    const saveDocument = vi.fn()
    await expect(
      registry.execute(
        'file.save',
        createExecutionContext({ hasSession: true, hasEditor: true, saveDocument })
      )
    ).resolves.toEqual({ status: 'executed' })
    expect(saveDocument).toHaveBeenCalledOnce()
  })
})
