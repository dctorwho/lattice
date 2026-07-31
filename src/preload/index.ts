import { contextBridge, ipcRenderer } from 'electron'

import type { ApprovedIpcChannel, LatticeDesktopApi } from '../shared/contracts'
import { createAppApi } from './api/create-app-api'

const app = Object.freeze(
  createAppApi({
    createRequestId: () => crypto.randomUUID(),
    invoke: async (
      channel: ApprovedIpcChannel,
      request: unknown
    ): Promise<unknown> => {
      const response: unknown = await ipcRenderer.invoke(channel, request)
      return response
    }
  })
)

const api: LatticeDesktopApi = Object.freeze({ app })
contextBridge.exposeInMainWorld('lattice', api)
