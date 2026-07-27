export interface RegisteredWindow<TSender extends object> {
  readonly windowId: number
  readonly webContentsId: number
  readonly sender: TSender
  readonly isWindowDestroyed: () => boolean
}

function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}

export class AuthorizedWindowRegistry<TSender extends object> {
  private readonly windows = new Map<number, RegisteredWindow<TSender>>()

  register(window: RegisteredWindow<TSender>): () => void {
    if (!isPositiveInteger(window.windowId)) {
      throw new Error('windowId must be a positive integer')
    }

    if (!isPositiveInteger(window.webContentsId)) {
      throw new Error('webContentsId must be a positive integer')
    }

    if (this.windows.has(window.webContentsId)) {
      throw new Error(`WebContents ${window.webContentsId} is already registered`)
    }

    const descriptor: RegisteredWindow<TSender> = {
      windowId: window.windowId,
      webContentsId: window.webContentsId,
      sender: window.sender,
      isWindowDestroyed: window.isWindowDestroyed
    }
    this.windows.set(descriptor.webContentsId, descriptor)

    return () => {
      if (this.windows.get(descriptor.webContentsId) === descriptor) {
        this.windows.delete(descriptor.webContentsId)
      }
    }
  }

  find(webContentsId: number): RegisteredWindow<TSender> | undefined {
    return this.windows.get(webContentsId)
  }
}
