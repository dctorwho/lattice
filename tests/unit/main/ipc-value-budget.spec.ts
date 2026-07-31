import { describe, expect, it } from 'vitest'

import {
  DEFAULT_IPC_VALUE_LIMITS,
  validateIpcValue,
  type IpcValueLimits
} from '../../../src/main/ipc/ipc-value-budget'

const smallLimits: IpcValueLimits = {
  maxCharacters: 64,
  maxDepth: 8,
  maxEntries: 8
}

function nestedObjects(depth: number): unknown {
  let value: unknown = null

  for (let index = 0; index < depth; index += 1) {
    value = { value }
  }

  return value
}

describe('TC-M0-005 IPC value budget', () => {
  it.each([
    null,
    true,
    false,
    0,
    1.25,
    '',
    'Lattice',
    [],
    [1, 'two', false, null],
    {},
    (() => {
      const value: Record<string, unknown> = { safe: true }
      Object.setPrototypeOf(value, null)
      return value
    })(),
    { nested: { value: ['ok'] } }
  ])('accepts a bounded JSON-like value: %o', (value) => {
    expect(validateIpcValue(value)).toEqual({ ok: true })
  })

  it.each([
    [undefined, 'unsupported_type'],
    [1n, 'unsupported_type'],
    [Symbol('x'), 'unsupported_type'],
    [() => undefined, 'unsupported_type'],
    [Number.NaN, 'non_finite_number'],
    [Number.POSITIVE_INFINITY, 'non_finite_number'],
    [new Date(), 'non_plain_object'],
    [new Map(), 'non_plain_object'],
    [new Set(), 'non_plain_object'],
    [Promise.resolve(), 'non_plain_object'],
    [new (class Unsafe {})(), 'non_plain_object']
  ] as const)('rejects %o as %s', (value, reason) => {
    expect(validateIpcValue(value)).toEqual({ ok: false, reason })
  })

  it('rejects character and entry counts immediately beyond their exact budgets', () => {
    expect(validateIpcValue('x'.repeat(DEFAULT_IPC_VALUE_LIMITS.maxCharacters + 1))).toEqual({
      ok: false,
      reason: 'character_budget_exceeded'
    })
    expect(validateIpcValue([null, null], { ...smallLimits, maxEntries: 1 })).toEqual({
      ok: false,
      reason: 'entry_budget_exceeded'
    })
  })

  it('counts object keys toward the character budget', () => {
    expect(validateIpcValue({ long: '' }, { ...smallLimits, maxCharacters: 3 })).toEqual({
      ok: false,
      reason: 'character_budget_exceeded'
    })
  })

  it('accepts depth eight and rejects depth nine', () => {
    expect(validateIpcValue(nestedObjects(8), smallLimits)).toEqual({ ok: true })
    expect(validateIpcValue(nestedObjects(9), smallLimits)).toEqual({
      ok: false,
      reason: 'depth_exceeded'
    })
  })

  it('rejects cycles without hanging', () => {
    const value: { self?: unknown } = {}
    value.self = value

    expect(validateIpcValue(value)).toEqual({ ok: false, reason: 'cycle' })
  })

  it('rejects accessors without invoking them', () => {
    let accessed = false
    const value = Object.defineProperty({}, 'secret', {
      enumerable: true,
      get: () => {
        accessed = true
        return 'document body'
      }
    })

    expect(validateIpcValue(value)).toEqual({ ok: false, reason: 'accessor' })
    expect(accessed).toBe(false)
  })

  it('rejects symbol keys before reading their values', () => {
    const key = Symbol('secret')
    const value = { [key]: 'document body' }

    expect(validateIpcValue(value)).toEqual({ ok: false, reason: 'symbol_key' })
  })

  it('counts sparse array holes as entries without reading absent indices', () => {
    const value = new Array<unknown>(2)
    value[1] = 'ok'

    expect(validateIpcValue(value, { ...smallLimits, maxEntries: 2 })).toEqual({ ok: true })
    expect(validateIpcValue(value, { ...smallLimits, maxEntries: 1 })).toEqual({
      ok: false,
      reason: 'entry_budget_exceeded'
    })
  })

  it('reads an array length from its descriptor instead of invoking a proxy getter', () => {
    let accessed = false
    const value = new Proxy<unknown[]>([], {
      get: (target, key, receiver) => {
        if (key === 'length') {
          accessed = true
        }
        const result: unknown = Reflect.get(target, key, receiver)
        return result
      }
    })

    expect(validateIpcValue(value)).toEqual({ ok: true })
    expect(accessed).toBe(false)
  })

  it('rejects non-index custom array properties', () => {
    const value: unknown[] = []
    Object.defineProperty(value, 'custom', { enumerable: true, value: 'unsafe' })

    expect(validateIpcValue(value)).toEqual({ ok: false, reason: 'non_plain_object' })
  })

  it.each([
    [new (class UnsafeArray extends Array<unknown> {})()],
    [
      (() => {
        const value: unknown[] = []
        Object.setPrototypeOf(value, { unsafe: true })
        return value
      })()
    ],
    [
      (() => {
        const value: unknown[] = []
        Object.setPrototypeOf(value, null)
        return value
      })()
    ]
  ])('rejects an array with a non-standard prototype: %o', (value) => {
    expect(validateIpcValue(value)).toEqual({ ok: false, reason: 'non_plain_object' })
  })

  it('allows shared references that are not ancestors', () => {
    const shared = { title: 'Lattice' }

    expect(validateIpcValue({ first: shared, second: shared })).toEqual({ ok: true })
  })
})
