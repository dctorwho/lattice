import { describe, expect, it } from 'vitest'

import {
  COMMAND_INVOKED_CHANNEL,
  COMMAND_UPDATE_STATES_CHANNEL,
  IPC_CONTRACT_VERSION,
  approvedIpcChannelSchema,
  commandInvokedEventSchema,
  commandStateSyncRequestSchema,
  commandStateSyncResultSchema
} from '../../../src/shared/contracts'
import { foundationCommandMetadata, translateFoundationMessage } from '../../../src/shared'

const requestId = '00000000-0000-4000-8000-000000000001'
const validStates = [
  { id: 'app.about', isVisible: true, isEnabled: true, isChecked: false },
  { id: 'edit.find', isVisible: true, isEnabled: true, isChecked: false },
  { id: 'edit.redo', isVisible: true, isEnabled: true, isChecked: false },
  { id: 'edit.replace', isVisible: true, isEnabled: true, isChecked: false },
  { id: 'edit.undo', isVisible: true, isEnabled: true, isChecked: false },
  { id: 'file.close', isVisible: true, isEnabled: true, isChecked: false },
  { id: 'file.new', isVisible: true, isEnabled: true, isChecked: false },
  { id: 'file.open', isVisible: true, isEnabled: true, isChecked: false },
  { id: 'file.save', isVisible: true, isEnabled: true, isChecked: false },
  { id: 'file.saveAs', isVisible: true, isEnabled: true, isChecked: false },
  { id: 'view.toggleSidebar', isVisible: true, isEnabled: true, isChecked: true }
] as const

describe('M0 command contracts', () => {
  it('owns immutable labels and shortcuts in one layer-neutral metadata table', () => {
    expect(Object.keys(foundationCommandMetadata)).toEqual([
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
    expect(foundationCommandMetadata['file.save']).toEqual({
      id: 'file.save',
      labelKey: 'commands.file.save',
      defaultShortcut: 'CommandOrControl+S',
      menuGroup: 'file',
      menuType: 'normal'
    })
    expect(foundationCommandMetadata['view.toggleSidebar']).toEqual({
      id: 'view.toggleSidebar',
      labelKey: 'commands.view.toggleSidebar',
      defaultShortcut: 'CommandOrControl+Shift+L',
      menuGroup: 'view',
      menuType: 'checkbox'
    })
    expect(Object.isFrozen(foundationCommandMetadata)).toBe(true)
    expect(Object.values(foundationCommandMetadata).every(Object.isFrozen)).toBe(true)
    expect(translateFoundationMessage('zh-CN', 'commands.app.about')).toBe('关于 Lattice')
    expect(translateFoundationMessage('en', 'menus.view')).toBe('View')
  })

  it('accepts the exact fixed invoke channel and strict state-sync envelope', () => {
    expect(approvedIpcChannelSchema.parse(COMMAND_UPDATE_STATES_CHANNEL)).toBe(
      'lattice:commands:update-states'
    )
    expect(COMMAND_INVOKED_CHANNEL).toBe('lattice:commands:invoked')
    expect(
      commandStateSyncRequestSchema.parse({
        contractVersion: IPC_CONTRACT_VERSION,
        requestId,
        payload: { states: validStates }
      })
    ).toEqual({ contractVersion: 1, requestId, payload: { states: validStates } })
  })

  it('激活 M1 文档与查找命令，并拒绝尚未实现的后续迭代命令', () => {
    expect(
      commandInvokedEventSchema.safeParse({ contractVersion: 1, id: 'file.new' }).success
    ).toBe(true)
    expect(
      commandInvokedEventSchema.safeParse({ contractVersion: 1, id: 'file.save' }).success
    ).toBe(true)
    expect(
      commandInvokedEventSchema.safeParse({ contractVersion: 1, id: 'edit.find' }).success
    ).toBe(true)
    expect(
      commandInvokedEventSchema.safeParse({ contractVersion: 1, id: 'file.export' }).success
    ).toBe(false)
  })

  it.each([
    { states: [] },
    { states: [validStates[0]] },
    { states: [validStates[10]] },
    { states: [validStates[0], validStates[0]] },
    { states: [...validStates, validStates[0]] },
    {
      states: [
        validStates[0],
        ...validStates.slice(1, 10),
        { id: 'file.export', isVisible: true, isEnabled: true, isChecked: false },
        validStates[10]
      ]
    },
    { states: [...validStates.slice(0, 10), { ...validStates[10], extra: true }] }
  ])(
    'rejects an incomplete, duplicate, unknown, oversized, or loose state set: $states',
    ({ states }) => {
      expect(
        commandStateSyncRequestSchema.safeParse({
          contractVersion: 1,
          requestId,
          payload: { states }
        }).success
      ).toBe(false)
    }
  )

  it.each([
    { contractVersion: 1, requestId, payload: { states: validStates }, extra: true },
    { contractVersion: 2, requestId, payload: { states: validStates } },
    { contractVersion: 1, requestId: 'not-a-uuid', payload: { states: validStates } },
    { contractVersion: 1, requestId, payload: { states: validStates, extra: true } }
  ])('rejects an invalid state-sync envelope: %o', (value) => {
    expect(commandStateSyncRequestSchema.safeParse(value).success).toBe(false)
  })

  it.each([
    { contractVersion: 1, id: 'app.about' },
    { contractVersion: 1, id: 'view.toggleSidebar' }
  ])('accepts an exact command event: %o', (event) => {
    expect(commandInvokedEventSchema.parse(event)).toEqual(event)
  })

  it.each([
    { contractVersion: 1, id: 'files.open' },
    { contractVersion: 2, id: 'app.about' },
    { contractVersion: 1, id: 'app.about', event: 'electron' },
    'app.about'
  ])('rejects an invalid command event: %o', (event) => {
    expect(commandInvokedEventSchema.safeParse(event).success).toBe(false)
  })

  it('accepts only the strict applied response', () => {
    expect(
      commandStateSyncResultSchema.parse({
        ok: true,
        value: { contractVersion: 1, applied: true }
      })
    ).toEqual({ ok: true, value: { contractVersion: 1, applied: true } })
    expect(
      commandStateSyncResultSchema.safeParse({
        ok: true,
        value: { contractVersion: 1, applied: true, windowId: 7 }
      }).success
    ).toBe(false)
  })
})
