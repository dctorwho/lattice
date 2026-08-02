import { useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react'

import type { CommandId, CommandState } from '../../../shared/contracts'
import type { ContextMenuState } from '../commands/use-command-controller'

interface CommandContextMenuProps {
  readonly menu: ContextMenuState
  readonly states: readonly CommandState[]
  readonly label: string
  readonly toggleLabel: string
  readonly aboutLabel: string
  readonly onSelect: (id: CommandId) => void
  readonly onClose: (restoreFocus: boolean) => void
}

function stateFor(states: readonly CommandState[], id: CommandId): CommandState | undefined {
  return states.find((state) => state.id === id)
}

export function CommandContextMenu(props: CommandContextMenuProps): JSX.Element {
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: props.menu.x, y: props.menu.y })

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (menu === null) return
    setPosition({
      x: Math.min(Math.max(0, props.menu.x), Math.max(0, window.innerWidth - menu.offsetWidth)),
      y: Math.min(Math.max(0, props.menu.y), Math.max(0, window.innerHeight - menu.offsetHeight))
    })
  }, [props.menu.x, props.menu.y])

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('[role^="menuitem"]')?.focus()
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      props.onClose(true)
    }
    const handlePointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && menuRef.current?.contains(event.target)) return
      props.onClose(true)
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [props])

  const toggle = stateFor(props.states, 'view.toggleSidebar')
  const about = stateFor(props.states, 'app.about')

  return (
    <div
      ref={menuRef}
      className="command-menu"
      role="menu"
      aria-label={props.label}
      style={{ left: position.x, top: position.y }}
    >
      {toggle?.isVisible === true && (
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={toggle.isChecked}
          disabled={!toggle.isEnabled}
          onClick={() => props.onSelect('view.toggleSidebar')}
        >
          {props.toggleLabel}
        </button>
      )}
      {about?.isVisible === true && (
        <button
          type="button"
          role="menuitem"
          disabled={!about.isEnabled}
          onClick={() => props.onSelect('app.about')}
        >
          {props.aboutLabel}
        </button>
      )}
    </div>
  )
}
