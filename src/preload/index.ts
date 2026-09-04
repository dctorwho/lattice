import { contextBridge, ipcRenderer } from 'electron'

import {
  WINDOW_CLOSE_REQUESTED_EVENT,
  type ApprovedIpcChannel,
  type LatticeDesktopApi
} from '../shared/contracts'
import { createAppApi } from './api/create-app-api'
import { createCommandApi } from './api/create-command-api'
import { createFilesApi } from './api/create-files-api'
import { createRecoveryApi } from './api/create-recovery-api'

type BufferedCloseListener = (event: unknown, payload: unknown) => void
const closeListeners = new Set<BufferedCloseListener>()
let pendingCloseEvent: { readonly event: unknown; readonly payload: unknown } | undefined
ipcRenderer.on(WINDOW_CLOSE_REQUESTED_EVENT, (event, payload) => {
  if (closeListeners.size === 0) {
    pendingCloseEvent = { event, payload }
    return
  }
  for (const listener of closeListeners) listener(event, payload)
})

const app = Object.freeze(
  createAppApi({
    createRequestId: () => crypto.randomUUID(),
    invoke: async (channel: ApprovedIpcChannel, request: unknown): Promise<unknown> => {
      const response: unknown = await ipcRenderer.invoke(channel, request)
      return response
    },
    on: (_channel, listener) => {
      closeListeners.add(listener)
      if (pendingCloseEvent !== undefined) {
        const pending = pendingCloseEvent
        pendingCloseEvent = undefined
        queueMicrotask(() => listener(pending.event, pending.payload))
      }
    },
    removeListener: (_channel, listener) => closeListeners.delete(listener)
  })
)

const commands = Object.freeze(
  createCommandApi({
    createRequestId: () => crypto.randomUUID(),
    invoke: async (channel: ApprovedIpcChannel, request: unknown): Promise<unknown> => {
      const response: unknown = await ipcRenderer.invoke(channel, request)
      return response
    },
    on: (channel, listener) => {
      ipcRenderer.on(channel, listener)
    },
    removeListener: (channel, listener) => {
      ipcRenderer.removeListener(channel, listener)
    },
    reportEventFailure: (reason) => {
      console.warn('lattice:command-event-rejected', { reason })
    }
  })
)

const files = Object.freeze(
  createFilesApi({
    createRequestId: () => crypto.randomUUID(),
    invoke: async (channel: ApprovedIpcChannel, request: unknown): Promise<unknown> => {
      const response: unknown = await ipcRenderer.invoke(channel, request)
      return response
    },
    on: (channel, listener) => ipcRenderer.on(channel, listener),
    removeListener: (channel, listener) => ipcRenderer.removeListener(channel, listener)
  })
)

const recovery = Object.freeze(
  createRecoveryApi({
    createRequestId: () => crypto.randomUUID(),
    invoke: async (channel: ApprovedIpcChannel, request: unknown): Promise<unknown> => {
      const response: unknown = await ipcRenderer.invoke(channel, request)
      return response
    }
  })
)

const api: LatticeDesktopApi = Object.freeze({ app, commands, files, recovery })
contextBridge.exposeInMainWorld('lattice', api)
