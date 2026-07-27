export interface IpcValueLimits {
  readonly maxCharacters: number
  readonly maxDepth: number
  readonly maxEntries: number
}

export const DEFAULT_IPC_VALUE_LIMITS: IpcValueLimits = {
  maxCharacters: 65_536,
  maxDepth: 8,
  maxEntries: 256
}

export type IpcValueRejectionReason =
  | 'unsupported_type'
  | 'non_finite_number'
  | 'character_budget_exceeded'
  | 'depth_exceeded'
  | 'entry_budget_exceeded'
  | 'symbol_key'
  | 'accessor'
  | 'non_plain_object'
  | 'cycle'

export type IpcValueValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: IpcValueRejectionReason }

const valid: IpcValueValidation = { ok: true }

function rejected(reason: IpcValueRejectionReason): IpcValueValidation {
  return { ok: false, reason }
}

function boundedLimit(value: number, fallback: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback
}

function normalizedLimits(limits: IpcValueLimits | undefined): IpcValueLimits {
  return {
    maxCharacters: boundedLimit(limits?.maxCharacters ?? DEFAULT_IPC_VALUE_LIMITS.maxCharacters, DEFAULT_IPC_VALUE_LIMITS.maxCharacters),
    maxDepth: boundedLimit(limits?.maxDepth ?? DEFAULT_IPC_VALUE_LIMITS.maxDepth, DEFAULT_IPC_VALUE_LIMITS.maxDepth),
    maxEntries: boundedLimit(limits?.maxEntries ?? DEFAULT_IPC_VALUE_LIMITS.maxEntries, DEFAULT_IPC_VALUE_LIMITS.maxEntries)
  }
}

function isArrayIndex(key: string, length: number): boolean {
  const index = Number(key)
  return Number.isInteger(index) && index >= 0 && index < length && String(index) === key
}

function isAccessor(descriptor: PropertyDescriptor): boolean {
  return descriptor.get !== undefined || descriptor.set !== undefined
}

export function validateIpcValue(value: unknown, limits?: IpcValueLimits): IpcValueValidation {
  const activeLimits = normalizedLimits(limits)
  const ancestors = new WeakSet<object>()
  let characterCount = 0
  let entryCount = 0

  const addCharacters = (characters: number): IpcValueValidation => {
    characterCount += characters
    return characterCount > activeLimits.maxCharacters
      ? rejected('character_budget_exceeded')
      : valid
  }

  const addEntries = (entries: number): IpcValueValidation => {
    entryCount += entries
    return entryCount > activeLimits.maxEntries ? rejected('entry_budget_exceeded') : valid
  }

  const walk = (candidate: unknown, depth: number): IpcValueValidation => {
    if (candidate === null || typeof candidate === 'boolean') {
      return valid
    }

    if (typeof candidate === 'string') {
      return addCharacters(candidate.length)
    }

    if (typeof candidate === 'number') {
      return Number.isFinite(candidate) ? valid : rejected('non_finite_number')
    }

    if (typeof candidate !== 'object') {
      return rejected('unsupported_type')
    }

    if (depth > activeLimits.maxDepth) {
      return rejected('depth_exceeded')
    }

    if (ancestors.has(candidate)) {
      return rejected('cycle')
    }

    ancestors.add(candidate)
    try {
      let descriptors: Record<string, PropertyDescriptor>
      let symbolKeys: symbol[]
      let prototype: object | null

      try {
        descriptors = Object.getOwnPropertyDescriptors(candidate)
        symbolKeys = Object.getOwnPropertySymbols(candidate)
        const discoveredPrototype: unknown = Object.getPrototypeOf(candidate)
        if (discoveredPrototype !== null && typeof discoveredPrototype !== 'object') {
          return rejected('non_plain_object')
        }
        prototype = discoveredPrototype
      } catch {
        return rejected('non_plain_object')
      }

      if (symbolKeys.length > 0) {
        return rejected('symbol_key')
      }

      if (Array.isArray(candidate)) {
        if (prototype !== Array.prototype) {
          return rejected('non_plain_object')
        }

        const lengthDescriptor = descriptors.length
        if (lengthDescriptor === undefined || isAccessor(lengthDescriptor)) {
          return rejected('accessor')
        }

        const lengthValue: unknown = lengthDescriptor.value
        if (
          typeof lengthValue !== 'number' ||
          !Number.isSafeInteger(lengthValue) ||
          lengthValue < 0
        ) {
          return rejected('non_plain_object')
        }
        const length = lengthValue
        const arrayEntries = addEntries(length)
        if (!arrayEntries.ok) {
          return arrayEntries
        }

        for (const [key, descriptor] of Object.entries(descriptors)) {
          if (key === 'length') {
            continue
          }

          if (!isArrayIndex(key, length)) {
            return rejected('non_plain_object')
          }

          if (isAccessor(descriptor)) {
            return rejected('accessor')
          }

          const nested = walk(descriptor.value, depth + 1)
          if (!nested.ok) {
            return nested
          }
        }

        return valid
      }

      if (prototype !== Object.prototype && prototype !== null) {
        return rejected('non_plain_object')
      }

      const entries = Object.entries(descriptors)
      const entryResult = addEntries(entries.length)
      if (!entryResult.ok) {
        return entryResult
      }

      for (const [key, descriptor] of entries) {
        const keyResult = addCharacters(key.length)
        if (!keyResult.ok) {
          return keyResult
        }

        if (isAccessor(descriptor)) {
          return rejected('accessor')
        }

        const nested = walk(descriptor.value, depth + 1)
        if (!nested.ok) {
          return nested
        }
      }

      return valid
    } finally {
      ancestors.delete(candidate)
    }
  }

  return walk(value, 1)
}
