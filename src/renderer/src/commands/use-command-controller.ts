import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import {
  CommandRegistry,
  createFoundationCommands,
  type CommandContext,
  type CommandExecutionContext,
  type CommandId,
  type CommandState
} from '../../../domain/commands'
import type { AppInfo } from '../../../shared/contracts'
import { foundationCommandMetadata, type FoundationCommandShortcut } from '../../../shared/commands'
import type { MessageKey } from '../i18n/messages'

export type AboutState =
  | { readonly status: 'closed' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly info: AppInfo }
  | { readonly status: 'error'; readonly messageKey: MessageKey }

export interface ContextMenuState {
  readonly x: number
  readonly y: number
  readonly trigger: HTMLElement
}

export interface CommandController {
  readonly isSidebarVisible: boolean
  readonly aboutState: AboutState
  readonly contextMenu: ContextMenuState | undefined
  readonly commandStates: readonly CommandState[]
  readonly statusKey: MessageKey
  readonly execute: (id: CommandId, trigger?: HTMLElement) => void
  readonly openContextMenu: (x: number, y: number, trigger: HTMLElement) => void
  readonly closeContextMenu: (restoreFocus: boolean) => void
  readonly selectContextCommand: (id: CommandId) => void
  readonly closeAbout: () => void
}

export interface CommandControllerRefs {
  readonly mainRef: RefObject<HTMLElement | null>
  readonly sidebarRef: RefObject<HTMLElement | null>
  readonly document?: DocumentCommandBindings
}

export interface DocumentCommandBindings {
  readonly hasSession: boolean
  readonly isSessionDirty: boolean
  readonly isSessionReadOnly: boolean
  readonly hasEditor: boolean
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly newDocument: () => void | Promise<void>
  readonly openDocument: () => void | Promise<void>
  readonly saveDocument: () => void | Promise<void>
  readonly saveDocumentAs: () => void | Promise<void>
  readonly closeDocument: () => void | Promise<void>
  readonly undo: () => void
  readonly redo: () => void
  readonly openFind: () => void
  readonly openReplace: () => void
}

const unavailableDocumentBindings: DocumentCommandBindings = {
  hasSession: false,
  isSessionDirty: false,
  isSessionReadOnly: false,
  hasEditor: false,
  canUndo: false,
  canRedo: false,
  newDocument: () => undefined,
  openDocument: () => undefined,
  saveDocument: () => undefined,
  saveDocumentAs: () => undefined,
  closeDocument: () => undefined,
  undo: () => undefined,
  redo: () => undefined,
  openFind: () => undefined,
  openReplace: () => undefined
}

function focusElement(element: HTMLElement | null): void {
  queueMicrotask(() => element?.focus())
}

function currentElement(): HTMLElement | undefined {
  return document.activeElement instanceof HTMLElement ? document.activeElement : undefined
}

function matchesShortcut(event: KeyboardEvent, shortcut: FoundationCommandShortcut): boolean {
  if (shortcut === 'F1') return event.key === 'F1'
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return false
  const expected = shortcut.replace('CommandOrControl+', '')
  const expectsShift = expected.startsWith('Shift+')
  const key = expectsShift ? expected.slice('Shift+'.length) : expected
  return event.shiftKey === expectsShift && event.key.toLocaleUpperCase('en-US') === key
}

export function useCommandController({
  mainRef,
  sidebarRef,
  document: documentBindings = unavailableDocumentBindings
}: CommandControllerRefs): CommandController {
  const desktopApi = useMemo(() => window.lattice, [])
  const registry = useMemo(() => new CommandRegistry(createFoundationCommands()), [])
  const aboutTriggerRef = useRef<HTMLElement | null>(null)
  const aboutRequestGenerationRef = useRef(0)
  const [isSidebarVisible, setSidebarVisible] = useState(true)
  const [aboutState, setAboutState] = useState<AboutState>({ status: 'closed' })
  const [contextMenu, setContextMenu] = useState<ContextMenuState>()
  const [isWindowFocused, setWindowFocused] = useState(true)
  const [statusKey, setStatusKey] = useState<MessageKey>('status.ready')
  const isDialogOpen = aboutState.status !== 'closed'

  const context = useMemo<CommandContext>(
    () => ({
      isSidebarVisible,
      isDialogOpen,
      isWindowFocused,
      hasSession: documentBindings.hasSession,
      isSessionDirty: documentBindings.isSessionDirty,
      isSessionReadOnly: documentBindings.isSessionReadOnly,
      hasEditor: documentBindings.hasEditor,
      canUndo: documentBindings.canUndo,
      canRedo: documentBindings.canRedo
    }),
    [documentBindings, isDialogOpen, isSidebarVisible, isWindowFocused]
  )
  const commandStates = useMemo(() => registry.getStates(context), [context, registry])

  const toggleSidebar = useCallback(
    (invocationTrigger: HTMLElement | null): void => {
      setSidebarVisible((visible) => {
        const sidebar = sidebarRef.current
        if (
          visible &&
          (sidebar?.contains(invocationTrigger ?? null) === true ||
            sidebar?.contains(document.activeElement) === true)
        ) {
          focusElement(mainRef.current)
        }
        return !visible
      })
    },
    [mainRef, sidebarRef]
  )

  const openAbout = useCallback(
    async (invocationTrigger: HTMLElement | null): Promise<void> => {
      aboutTriggerRef.current = invocationTrigger ?? mainRef.current
      const requestGeneration = aboutRequestGenerationRef.current + 1
      aboutRequestGenerationRef.current = requestGeneration
      setAboutState({ status: 'loading' })
      try {
        const result = await desktopApi.app.getInfo()
        if (aboutRequestGenerationRef.current !== requestGeneration) return
        setAboutState(
          result.ok
            ? { status: 'ready', info: result.value }
            : { status: 'error', messageKey: result.error.messageKey }
        )
      } catch {
        if (aboutRequestGenerationRef.current !== requestGeneration) return
        setAboutState({ status: 'error', messageKey: 'errors.internal.unexpected' })
      }
    },
    [desktopApi, mainRef]
  )

  const execute = useCallback(
    (id: CommandId, trigger?: HTMLElement): void => {
      const invocationTrigger = trigger ?? currentElement() ?? null
      const executionContext: CommandExecutionContext = {
        ...context,
        toggleSidebar: () => toggleSidebar(invocationTrigger),
        openAbout: () => openAbout(invocationTrigger),
        newDocument: documentBindings.newDocument,
        openDocument: documentBindings.openDocument,
        saveDocument: documentBindings.saveDocument,
        saveDocumentAs: documentBindings.saveDocumentAs,
        closeDocument: documentBindings.closeDocument,
        undo: documentBindings.undo,
        redo: documentBindings.redo,
        openFind: documentBindings.openFind,
        openReplace: documentBindings.openReplace
      }
      void registry.execute(id, executionContext).then((result) => {
        switch (result.status) {
          case 'executed':
            setStatusKey('status.executed')
            break
          case 'disabled':
          case 'not-visible':
            setStatusKey('status.disabled')
            break
          case 'failed':
          case 'not-found':
            setStatusKey('status.failed')
            break
        }
      })
    },
    [context, documentBindings, openAbout, registry, toggleSidebar]
  )
  const executeRef = useRef(execute)
  useEffect(() => {
    executeRef.current = execute
  }, [execute])

  useEffect(() => {
    const unsubscribe = desktopApi.commands.onInvoke((id) => executeRef.current(id))
    return unsubscribe
  }, [desktopApi])

  useEffect(() => {
    let active = true
    void desktopApi.commands
      .updateStates(commandStates)
      .then((result) => {
        if (active && !result.ok) setStatusKey('status.menuSyncFailed')
      })
      .catch(() => {
        if (active) setStatusKey('status.menuSyncFailed')
      })
    return () => {
      active = false
    }
  }, [commandStates, desktopApi])

  useEffect(() => {
    const handleFocus = (): void => setWindowFocused(true)
    const handleBlur = (): void => setWindowFocused(false)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isWindowFocused) return
      const command = Object.values(foundationCommandMetadata).find((metadata) =>
        matchesShortcut(event, metadata.defaultShortcut)
      )
      if (command === undefined) return
      event.preventDefault()
      executeRef.current(command.id, currentElement())
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isWindowFocused])

  const closeContextMenu = useCallback(
    (restoreFocus: boolean): void => {
      const trigger = contextMenu?.trigger
      setContextMenu(undefined)
      if (restoreFocus) focusElement(trigger ?? mainRef.current)
    },
    [contextMenu, mainRef]
  )

  const selectContextCommand = useCallback(
    (id: CommandId): void => {
      const trigger = contextMenu?.trigger
      setContextMenu(undefined)
      execute(id, trigger)
    },
    [contextMenu, execute]
  )

  const closeAbout = useCallback((): void => {
    aboutRequestGenerationRef.current += 1
    setAboutState({ status: 'closed' })
    const target = aboutTriggerRef.current ?? mainRef.current
    aboutTriggerRef.current = null
    focusElement(target)
  }, [mainRef])

  return {
    isSidebarVisible,
    aboutState,
    contextMenu,
    commandStates,
    statusKey,
    execute,
    openContextMenu: (x, y, trigger) => setContextMenu({ x, y, trigger }),
    closeContextMenu,
    selectContextCommand,
    closeAbout
  }
}
