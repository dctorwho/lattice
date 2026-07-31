import { createAppError, type AppError, type IpcSafeReason } from '../../shared/errors'

import { type AuthorizedWindowRegistry } from './authorized-window-registry'

export interface IpcSenderEvent<TSender extends object, TFrame extends object> {
  readonly sender: TSender
  readonly senderId: number
  readonly senderFrame: TFrame | null
  readonly mainFrame: TFrame
  readonly isSenderDestroyed: () => boolean
}

export interface ValidatedIpcContext {
  readonly requestId: string
  readonly windowId: number
  readonly webContentsId: number
  readonly sessionId: null
}

export type SenderValidationReason =
  | 'missing_sender_frame'
  | 'sender_destroyed'
  | 'subframe_sender'
  | 'window_not_registered'
  | 'sender_identity_mismatch'
  | 'window_destroyed'

export type SenderValidation =
  | { readonly ok: true; readonly context: ValidatedIpcContext }
  | { readonly ok: false; readonly reason: SenderValidationReason; readonly error: AppError }

function rejected(reason: SenderValidationReason, requestId: string): SenderValidation {
  const safeReason: IpcSafeReason = reason
  return {
    ok: false,
    reason,
    error: createAppError('IPC_UNAUTHORIZED_SENDER', requestId, { reason: safeReason })
  }
}

export function validateIpcSender<TSender extends object, TFrame extends object>(
  event: IpcSenderEvent<TSender, TFrame>,
  registry: AuthorizedWindowRegistry<TSender>,
  requestId: string
): SenderValidation {
  if (event.senderFrame === null) {
    return rejected('missing_sender_frame', requestId)
  }

  let senderDestroyed: boolean
  try {
    senderDestroyed = event.isSenderDestroyed()
  } catch {
    return rejected('sender_destroyed', requestId)
  }

  if (senderDestroyed) {
    return rejected('sender_destroyed', requestId)
  }

  if (event.senderFrame !== event.mainFrame) {
    return rejected('subframe_sender', requestId)
  }

  const registeredWindow = registry.find(event.senderId)
  if (registeredWindow === undefined) {
    return rejected('window_not_registered', requestId)
  }

  if (registeredWindow.sender !== event.sender) {
    return rejected('sender_identity_mismatch', requestId)
  }

  let windowDestroyed: boolean
  try {
    windowDestroyed = registeredWindow.isWindowDestroyed()
  } catch {
    return rejected('window_destroyed', requestId)
  }

  if (windowDestroyed) {
    return rejected('window_destroyed', requestId)
  }

  return {
    ok: true,
    context: {
      requestId,
      windowId: registeredWindow.windowId,
      webContentsId: registeredWindow.webContentsId,
      sessionId: null
    }
  }
}
