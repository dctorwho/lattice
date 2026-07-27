import { describe, expect, it } from 'vitest'

import { AuthorizedWindowRegistry } from '../../../src/main/ipc/authorized-window-registry'
import {
  validateIpcSender,
  type IpcSenderEvent
} from '../../../src/main/ipc/validate-ipc-sender'

type FakeSender = { readonly label: string }
type FakeFrame = { readonly label: string }

const requestId = '00000000-0000-4000-8000-000000000001'

function createEvent(overrides: Partial<IpcSenderEvent<FakeSender, FakeFrame>> = {}): IpcSenderEvent<FakeSender, FakeFrame> {
  const sender: FakeSender = { label: 'sender' }
  const mainFrame: FakeFrame = { label: 'main' }

  return {
    sender,
    senderId: 11,
    senderFrame: mainFrame,
    mainFrame,
    isSenderDestroyed: () => false,
    ...overrides
  }
}

function registerEventSender(
  registry: AuthorizedWindowRegistry<FakeSender>,
  event: IpcSenderEvent<FakeSender, FakeFrame>,
  isWindowDestroyed: () => boolean = () => false
): void {
  registry.register({
    windowId: 7,
    webContentsId: event.senderId,
    sender: event.sender,
    isWindowDestroyed
  })
}

function expectedFailure(reason: string): object {
  return {
    ok: false,
    reason,
    error: {
      code: 'IPC_UNAUTHORIZED_SENDER',
      messageKey: 'errors.ipc.unauthorizedSender',
      retryable: false,
      safeDetails: { reason },
      requestId
    }
  }
}

describe('IPC sender validation', () => {
  it('returns main-derived context for a registered main-frame sender', () => {
    const registry = new AuthorizedWindowRegistry<FakeSender>()
    const event = createEvent()
    registerEventSender(registry, event)

    expect(validateIpcSender(event, registry, requestId)).toEqual({
      ok: true,
      context: { requestId, windowId: 7, webContentsId: 11, sessionId: null }
    })
  })

  it('uses the stable missing sender-frame reason before other failures', () => {
    const registry = new AuthorizedWindowRegistry<FakeSender>()
    const event = createEvent({ senderFrame: null, isSenderDestroyed: () => true })

    expect(validateIpcSender(event, registry, requestId)).toEqual(
      expectedFailure('missing_sender_frame')
    )
  })

  it.each([
    [createEvent({ isSenderDestroyed: () => true }), 'sender_destroyed'],
    [
      createEvent({ senderFrame: { label: 'subframe' } }),
      'subframe_sender'
    ],
    [createEvent(), 'window_not_registered']
  ] as const)('rejects an unregistered event as %s', (event, reason) => {
    const registry = new AuthorizedWindowRegistry<FakeSender>()

    expect(validateIpcSender(event, registry, requestId)).toEqual(expectedFailure(reason))
  })

  it('fails closed when the sender destruction callback throws', () => {
    const registry = new AuthorizedWindowRegistry<FakeSender>()
    const event = createEvent({
      isSenderDestroyed: () => {
        throw new Error('sender callback failed')
      }
    })

    expect(validateIpcSender(event, registry, requestId)).toEqual(
      expectedFailure('sender_destroyed')
    )
  })

  it('prioritizes sender destruction over a subframe sender', () => {
    const registry = new AuthorizedWindowRegistry<FakeSender>()
    const event = createEvent({
      senderFrame: { label: 'subframe' },
      isSenderDestroyed: () => true
    })

    expect(validateIpcSender(event, registry, requestId)).toEqual(
      expectedFailure('sender_destroyed')
    )
  })

  it('rejects a registered ID whose sender object differs', () => {
    const registry = new AuthorizedWindowRegistry<FakeSender>()
    const event = createEvent()
    registry.register({
      windowId: 7,
      webContentsId: 11,
      sender: { label: 'other sender' },
      isWindowDestroyed: () => false
    })

    expect(validateIpcSender(event, registry, requestId)).toEqual(
      expectedFailure('sender_identity_mismatch')
    )
  })

  it('rejects a registered sender whose owning window is destroyed', () => {
    const registry = new AuthorizedWindowRegistry<FakeSender>()
    const event = createEvent()
    registerEventSender(registry, event, () => true)

    expect(validateIpcSender(event, registry, requestId)).toEqual(
      expectedFailure('window_destroyed')
    )
  })

  it('fails closed when the owning-window destruction callback throws', () => {
    const registry = new AuthorizedWindowRegistry<FakeSender>()
    const event = createEvent()
    registerEventSender(registry, event, () => {
      throw new Error('window callback failed')
    })

    expect(validateIpcSender(event, registry, requestId)).toEqual(
      expectedFailure('window_destroyed')
    )
  })

  it('prioritizes sender identity mismatch over window destruction', () => {
    const registry = new AuthorizedWindowRegistry<FakeSender>()
    const event = createEvent()
    registry.register({
      windowId: 7,
      webContentsId: 11,
      sender: { label: 'other sender' },
      isWindowDestroyed: () => true
    })

    expect(validateIpcSender(event, registry, requestId)).toEqual(
      expectedFailure('sender_identity_mismatch')
    )
  })
})
