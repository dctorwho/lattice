import {
  COMMAND_INVOKED_CHANNEL,
  IPC_CONTRACT_VERSION,
  commandInvokedEventSchema,
  commandStateCollectionSchema,
  type CommandId,
  type CommandState
} from '../../shared/contracts'

export interface ApplicationMenuItem {
  visible: boolean
  enabled: boolean
  checked: boolean
}

export interface ApplicationMenuTemplateItem {
  readonly id: CommandId
  readonly label: string
  readonly accelerator: string
  readonly type: 'normal' | 'checkbox'
  readonly visible: boolean
  readonly enabled: boolean
  readonly checked: boolean
  readonly click: () => void
}

export interface ApplicationMenuTemplate {
  readonly label: string
  readonly submenu: readonly ApplicationMenuTemplateItem[]
}

export interface ApplicationMenuAdapter<TMenu> {
  readonly buildFromTemplate: (template: readonly ApplicationMenuTemplate[]) => TMenu
  readonly setApplicationMenu: (menu: TMenu) => void
  readonly getMenuItemById: (menu: TMenu, id: CommandId) => ApplicationMenuItem | undefined
}

export interface CommandTarget {
  readonly windowId: number
  readonly send: (
    channel: typeof COMMAND_INVOKED_CHANNEL,
    event: { readonly contractVersion: 1; readonly id: CommandId }
  ) => void
}

export interface ApplicationMenuController {
  readonly install: () => void
  readonly updateStates: (windowId: number, states: unknown) => boolean
  readonly applyForFocusedWindow: () => void
  readonly removeWindow: (windowId: number) => void
}

export interface ApplicationMenuDependencies<TMenu> {
  readonly adapter: ApplicationMenuAdapter<TMenu>
  readonly resolveFocusedTarget: () => CommandTarget | undefined
}

const failClosedStates: readonly CommandState[] = [
  { id: 'app.about', isVisible: true, isEnabled: false, isChecked: false },
  { id: 'view.toggleSidebar', isVisible: true, isEnabled: false, isChecked: false }
]

function safeFocusedTarget(resolve: () => CommandTarget | undefined): CommandTarget | undefined {
  try {
    return resolve()
  } catch {
    return undefined
  }
}

export function createApplicationMenu<TMenu>(
  dependencies: ApplicationMenuDependencies<TMenu>
): ApplicationMenuController {
  const statesByWindow = new Map<number, readonly CommandState[]>()
  let menu: TMenu | undefined

  const applyStates = (states: readonly CommandState[]): void => {
    if (menu === undefined) return
    for (const state of states) {
      const item = dependencies.adapter.getMenuItemById(menu, state.id)
      if (item === undefined) continue
      item.visible = state.isVisible
      item.enabled = state.isEnabled
      item.checked = state.id === 'view.toggleSidebar' && state.isChecked
    }
  }

  const relay = (id: CommandId): void => {
    const target = safeFocusedTarget(dependencies.resolveFocusedTarget)
    if (target === undefined) return
    const event = commandInvokedEventSchema.parse({
      contractVersion: IPC_CONTRACT_VERSION,
      id
    })
    try {
      target.send(COMMAND_INVOKED_CHANNEL, event)
    } catch {
      // A disappearing window must not turn a menu click into an uncaught error.
    }
  }

  const template: readonly ApplicationMenuTemplate[] = [
    {
      label: 'View',
      submenu: [
        {
          id: 'view.toggleSidebar',
          label: 'Toggle Sidebar',
          accelerator: 'CommandOrControl+Shift+L',
          type: 'checkbox',
          visible: true,
          enabled: false,
          checked: false,
          click: () => relay('view.toggleSidebar')
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          id: 'app.about',
          label: 'About Lattice',
          accelerator: 'F1',
          type: 'normal',
          visible: true,
          enabled: false,
          checked: false,
          click: () => relay('app.about')
        }
      ]
    }
  ]

  const applyForFocusedWindow = (): void => {
    const target = safeFocusedTarget(dependencies.resolveFocusedTarget)
    applyStates(
      target === undefined
        ? failClosedStates
        : (statesByWindow.get(target.windowId) ?? failClosedStates)
    )
  }

  return {
    install: () => {
      if (menu !== undefined) return
      menu = dependencies.adapter.buildFromTemplate(template)
      dependencies.adapter.setApplicationMenu(menu)
      applyForFocusedWindow()
    },
    updateStates: (windowId, states) => {
      if (!Number.isSafeInteger(windowId) || windowId <= 0) return false
      const parsed = commandStateCollectionSchema.safeParse(states)
      if (!parsed.success) return false
      const snapshot = Object.freeze(parsed.data.map((state) => Object.freeze({ ...state })))
      statesByWindow.set(windowId, snapshot)
      if (safeFocusedTarget(dependencies.resolveFocusedTarget)?.windowId === windowId) {
        applyStates(snapshot)
      }
      return true
    },
    applyForFocusedWindow,
    removeWindow: (windowId) => {
      statesByWindow.delete(windowId)
      if (safeFocusedTarget(dependencies.resolveFocusedTarget)?.windowId === windowId) {
        applyStates(failClosedStates)
      }
    }
  }
}
