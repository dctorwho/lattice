import { contextBridge, ipcRenderer } from 'electron'

import type { ApprovedIpcChannel, LatticeDesktopApi } from '../shared/contracts'
import { createAppApi } from './api/create-app-api'
import { createCommandApi } from './api/create-command-api'

const app = Object.freeze(
  createAppApi({
    createRequestId: () => crypto.randomUUID(),
    invoke: async (channel: ApprovedIpcChannel, request: unknown): Promise<unknown> => {
      const response: unknown = await ipcRenderer.invoke(channel, request)
      return response
    }
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

const api: LatticeDesktopApi = Object.freeze({ app, commands })
contextBridge.exposeInMainWorld('lattice', api)
