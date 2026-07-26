import { z } from 'zod'

export const IPC_CONTRACT_VERSION = 1 as const
export const ipcContractVersionSchema = z.literal(IPC_CONTRACT_VERSION)
export type IpcContractVersion = z.infer<typeof ipcContractVersionSchema>
