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
}

function focusElement(element: HTMLElement | null): void {
  queueMicrotask(() => element?.focus())
}

function currentElement(): HTMLElement | undefined {
  return document.activeElement instanceof HTMLElement ? document.activeElement : undefined
}

export function useCommandController({
  mainRef,
  sidebarRef
}: CommandControllerRefs): CommandController {
  const registry = useMemo(() => new CommandRegistry(createFoundationCommands()), [])
  const aboutTriggerRef = useRef<HTMLElement | null>(null)
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
      hasSession: false,
      isSessionDirty: false,
      hasEditor: false
    }),
    [isDialogOpen, isSidebarVisible, isWindowFocused]
  )
  const commandStates = useMemo(() => registry.getStates(context), [context, registry])

  const toggleSidebar = useCallback((): void => {
    setSidebarVisible((visible) => {
      if (visible && sidebarRef.current?.contains(document.activeElement)) {
        focusElement(mainRef.current)
      }
      return !visible
    })
  }, [mainRef, sidebarRef])

  const openAbout = useCallback(async (): Promise<void> => {
    setAboutState({ status: 'loading' })
    try {
      const result = await window.lattice.app.getInfo()
      setAboutState(
        result.ok
          ? { status: 'ready', info: result.value }
          : { status: 'error', messageKey: result.error.messageKey }
      )
    } catch {
      setAboutState({ status: 'error', messageKey: 'errors.internal.unexpected' })
    }
  }, [])

  const execute = useCallback(
    (id: CommandId, trigger?: HTMLElement): void => {
      if (id === 'app.about') {
        aboutTriggerRef.current = trigger ?? currentElement() ?? mainRef.current
      }
      const executionContext: CommandExecutionContext = {
        ...context,
        toggleSidebar,
        openAbout
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
    [context, mainRef, openAbout, registry, toggleSidebar]
  )
  const executeRef = useRef(execute)
  useEffect(() => {
    executeRef.current = execute
  }, [execute])

  useEffect(() => {
    const unsubscribe = window.lattice.commands.onInvoke((id) => executeRef.current(id))
    return unsubscribe
  }, [])

  useEffect(() => {
    let active = true
    void window.lattice.commands
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
  }, [commandStates])

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
      const sidebarShortcut =
        event.code === 'KeyL' && event.shiftKey && (event.ctrlKey || event.metaKey)
      const aboutShortcut = event.key === 'F1'
      if (!sidebarShortcut && !aboutShortcut) return
      event.preventDefault()
      executeRef.current(sidebarShortcut ? 'view.toggleSidebar' : 'app.about', currentElement())
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
