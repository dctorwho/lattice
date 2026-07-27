import { describe, expect, it } from 'vitest'

import { AuthorizedWindowRegistry } from '../../../src/main/ipc/authorized-window-registry'

describe('authorized window registry', () => {
  it('registers, resolves, and removes the exact sender identity', () => {
    const registry = new AuthorizedWindowRegistry<object>()
    const sender = {}
    const isWindowDestroyed = () => false
    const remove = registry.register({
      windowId: 7,
      webContentsId: 11,
      sender,
      isWindowDestroyed
    })

    expect(registry.find(11)).toEqual({
      windowId: 7,
      webContentsId: 11,
      sender,
      isWindowDestroyed
    })

    remove()
    expect(registry.find(11)).toBeUndefined()
  })

  it('rejects duplicate WebContents registration instead of replacing ownership', () => {
    const registry = new AuthorizedWindowRegistry<object>()
    registry.register({ windowId: 7, webContentsId: 11, sender: {}, isWindowDestroyed: () => false })

    expect(() =>
      registry.register({ windowId: 8, webContentsId: 11, sender: {}, isWindowDestroyed: () => false })
    ).toThrow('WebContents 11 is already registered')
  })

  it('does not allow an old cleanup closure to delete a newer registration', () => {
    const registry = new AuthorizedWindowRegistry<object>()
    const oldCleanup = registry.register({
      windowId: 7,
      webContentsId: 11,
      sender: {},
      isWindowDestroyed: () => false
    })
    oldCleanup()

    const replacementSender = {}
    registry.register({
      windowId: 8,
      webContentsId: 11,
      sender: replacementSender,
      isWindowDestroyed: () => false
    })
    oldCleanup()

    expect(registry.find(11)?.sender).toBe(replacementSender)
  })

  it.each([
    { windowId: -1, webContentsId: 11 },
    { windowId: 0, webContentsId: 11 },
    { windowId: 1.5, webContentsId: 11 },
    { windowId: 7, webContentsId: -1 },
    { windowId: 7, webContentsId: 0 },
    { windowId: 7, webContentsId: 11.5 }
  ])('rejects invalid positive integer IDs: %o', ({ windowId, webContentsId }) => {
    const registry = new AuthorizedWindowRegistry<object>()

    expect(() =>
      registry.register({ windowId, webContentsId, sender: {}, isWindowDestroyed: () => false })
    ).toThrow()
  })
})
