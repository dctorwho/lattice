import { describe, expect, it } from 'vitest'

import {
  createApplicationMenu,
  type ApplicationMenuAdapter,
  type ApplicationMenuItem,
  type ApplicationMenuTemplate,
  type CommandTarget
} from '../../../src/main/commands/application-menu'
import { registerCommandStateIpc } from '../../../src/main/ipc/register-command-state-ipc'
import {
  COMMAND_INVOKED_CHANNEL,
  COMMAND_UPDATE_STATES_CHANNEL
} from '../../../src/shared/contracts'

const enabledStates = [
  { id: 'app.about', isVisible: true, isEnabled: true, isChecked: false },
  { id: 'view.toggleSidebar', isVisible: true, isEnabled: true, isChecked: true }
] as const

interface MenuHarness {
  readonly adapter: ApplicationMenuAdapter<object>
  readonly items: ReadonlyMap<string, ApplicationMenuItem>
  readonly readTemplate: () => readonly ApplicationMenuTemplate[] | undefined
  readonly readInstalled: () => object | undefined
}

function createMenuHarness(): MenuHarness {
  const items = new Map<string, ApplicationMenuItem>()
  let template: readonly ApplicationMenuTemplate[] | undefined
  let installed: object | undefined
  const menu = {}

  return {
    adapter: {
      buildFromTemplate: (nextTemplate) => {
        template = nextTemplate
        for (const group of nextTemplate) {
          for (const item of group.submenu) {
            items.set(item.id, {
              visible: item.visible,
              enabled: item.enabled,
              checked: item.checked
            })
          }
        }
        return menu
      },
      setApplicationMenu: (nextMenu) => {
        installed = nextMenu
      },
      getMenuItemById: (_menu, id) => items.get(id)
    },
    items,
    readTemplate: () => template,
    readInstalled: () => installed
  }
}

function requireTemplate(harness: MenuHarness): readonly ApplicationMenuTemplate[] {
  const template = harness.readTemplate()
  if (template === undefined) throw new Error('Expected application menu template')
  return template
}

function findTemplateItem(
  template: readonly ApplicationMenuTemplate[],
  id: 'app.about' | 'view.toggleSidebar'
) {
  for (const group of template) {
    const item = group.submenu.find((candidate) => candidate.id === id)
    if (item !== undefined) return item
  }
  throw new Error(`Expected menu item ${id}`)
}

describe('M0 application menu projection', () => {
  it('installs only the fixed fail-closed View and Help commands', () => {
    const harness = createMenuHarness()
    const controller = createApplicationMenu({
      adapter: harness.adapter,
      resolveFocusedTarget: () => undefined
    })

    controller.install()

    expect(harness.readInstalled()).toBeDefined()
    const template = requireTemplate(harness)
    expect(
      template.map((group) => ({
        label: group.label,
        items: group.submenu.map(({ id, label, accelerator, type }) => ({
          id,
          label,
          accelerator,
          type
        }))
      }))
    ).toEqual([
      {
        label: '视图',
        items: [
          {
            id: 'view.toggleSidebar',
            label: '切换侧栏',
            accelerator: 'CommandOrControl+Shift+L',
            type: 'checkbox'
          }
        ]
      },
      {
        label: '帮助',
        items: [
          {
            id: 'app.about',
            label: '关于 Lattice',
            accelerator: 'F1',
            type: 'normal'
          }
        ]
      }
    ])
    expect(harness.items.get('view.toggleSidebar')).toEqual({
      visible: true,
      enabled: false,
      checked: false
    })
    expect(harness.items.get('app.about')).toEqual({
      visible: true,
      enabled: false,
      checked: false
    })
  })

  it('relays a click only to the current authorized command target', () => {
    const sent: unknown[] = []
    const target: CommandTarget = {
      windowId: 7,
      send: (channel, event) => sent.push({ channel, event })
    }
    const harness = createMenuHarness()
    const controller = createApplicationMenu({
      adapter: harness.adapter,
      resolveFocusedTarget: () => target
    })
    controller.install()
    const template = requireTemplate(harness)

    findTemplateItem(template, 'view.toggleSidebar').click()
    findTemplateItem(template, 'app.about').click()

    expect(sent).toEqual([
      {
        channel: COMMAND_INVOKED_CHANNEL,
        event: { contractVersion: 1, id: 'view.toggleSidebar' }
      },
      {
        channel: COMMAND_INVOKED_CHANNEL,
        event: { contractVersion: 1, id: 'app.about' }
      }
    ])
  })

  it('does not relay a click without an authorized focused target', () => {
    const harness = createMenuHarness()
    const controller = createApplicationMenu({
      adapter: harness.adapter,
      resolveFocusedTarget: () => undefined
    })
    controller.install()

    expect(() => findTemplateItem(requireTemplate(harness), 'app.about').click()).not.toThrow()
  })

  it('projects only the focused window snapshot and restores another window on focus', () => {
    let focusedWindowId = 7
    const harness = createMenuHarness()
    const controller = createApplicationMenu({
      adapter: harness.adapter,
      resolveFocusedTarget: () => ({ windowId: focusedWindowId, send: () => {} })
    })
    controller.install()

    expect(controller.updateStates(7, enabledStates)).toBe(true)
    expect(harness.items.get('view.toggleSidebar')).toEqual({
      visible: true,
      enabled: true,
      checked: true
    })

    const windowEightStates = [
      { id: 'app.about', isVisible: false, isEnabled: false, isChecked: false },
      { id: 'view.toggleSidebar', isVisible: true, isEnabled: true, isChecked: false }
    ] as const
    expect(controller.updateStates(8, windowEightStates)).toBe(true)
    expect(harness.items.get('app.about')?.visible).toBe(true)

    focusedWindowId = 8
    controller.applyForFocusedWindow()
    expect(harness.items.get('app.about')).toEqual({
      visible: false,
      enabled: false,
      checked: false
    })
    expect(harness.items.get('view.toggleSidebar')?.checked).toBe(false)
  })

  it('fails closed when no authorized window is focused', () => {
    let target: CommandTarget | undefined = { windowId: 7, send: () => {} }
    const harness = createMenuHarness()
    const controller = createApplicationMenu({
      adapter: harness.adapter,
      resolveFocusedTarget: () => target
    })
    controller.install()
    controller.updateStates(7, enabledStates)

    target = undefined
    controller.applyForFocusedWindow()

    expect(harness.items.get('app.about')?.enabled).toBe(false)
    expect(harness.items.get('view.toggleSidebar')).toEqual({
      visible: true,
      enabled: false,
      checked: false
    })
  })

  it('rejects an invalid state set without changing the last valid projection', () => {
    const harness = createMenuHarness()
    const controller = createApplicationMenu({
      adapter: harness.adapter,
      resolveFocusedTarget: () => ({ windowId: 7, send: () => {} })
    })
    controller.install()
    controller.updateStates(7, enabledStates)

    expect(controller.updateStates(7, [enabledStates[0], enabledStates[0]])).toBe(false)
    expect(harness.items.get('view.toggleSidebar')).toEqual({
      visible: true,
      enabled: true,
      checked: true
    })
  })

  it('fails closed after the focused window snapshot is removed', () => {
    let target: CommandTarget | undefined = { windowId: 7, send: () => {} }
    const harness = createMenuHarness()
    const controller = createApplicationMenu({
      adapter: harness.adapter,
      resolveFocusedTarget: () => target
    })
    controller.install()
    controller.updateStates(7, enabledStates)

    target = undefined
    controller.removeWindow(7)

    expect(harness.items.get('app.about')?.enabled).toBe(false)
    expect(harness.items.get('view.toggleSidebar')).toEqual({
      visible: true,
      enabled: false,
      checked: false
    })
  })
})

describe('M0 command-state IPC registration', () => {
  it('registers the fixed channel, forwards once, and removes exactly once', async () => {
    const registrations: string[] = []
    const removals: string[] = []
    const dispatches: unknown[] = []
    let listener: ((event: object, input: unknown) => Promise<unknown>) | undefined
    const event = { label: 'event' }
    const input = { label: 'input' }
    const cleanup = registerCommandStateIpc<object>(
      {
        handle: (channel, next) => {
          registrations.push(channel)
          listener = next
        },
        removeHandler: (channel) => removals.push(channel)
      },
      {
        dispatch: (channel, forwardedEvent, forwardedInput) => {
          dispatches.push({ channel, event: forwardedEvent, input: forwardedInput })
          return Promise.resolve('forwarded')
        }
      }
    )
    const registeredListener = listener
    if (registeredListener === undefined) throw new Error('Expected command-state listener')

    await expect(registeredListener(event, input)).resolves.toBe('forwarded')
    expect(registrations).toEqual([COMMAND_UPDATE_STATES_CHANNEL])
    expect(dispatches).toEqual([{ channel: COMMAND_UPDATE_STATES_CHANNEL, event, input }])

    cleanup()
    cleanup()
    expect(removals).toEqual([COMMAND_UPDATE_STATES_CHANNEL])
  })
})
