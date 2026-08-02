import { z } from 'zod'

import { commandIds, type CommandId, type CommandState } from '../../domain/commands'
import { createResultSchema } from '../errors'
import { IPC_CONTRACT_VERSION } from './contract-version'
import { createIpcRequestEnvelopeSchema } from './ipc-request'

export const commandIdSchema = z.enum(commandIds)

export const commandStateSchema = z
  .object({
    id: commandIdSchema,
    isVisible: z.boolean(),
    isEnabled: z.boolean(),
    isChecked: z.boolean()
  })
  .strict()

export const commandStateCollectionSchema = z
  .array(commandStateSchema)
  .length(commandIds.length)
  .superRefine((states, context) => {
    const ids = new Set(states.map((state) => state.id))
    for (const id of commandIds) {
      if (!ids.has(id)) {
        context.addIssue({ code: 'custom', message: `Missing command state: ${id}` })
      }
    }
  })

const commandStateSyncPayloadSchema = z.object({ states: commandStateCollectionSchema }).strict()

export const commandStateSyncRequestSchema = createIpcRequestEnvelopeSchema(
  commandStateSyncPayloadSchema
)

export const commandStateSyncSchema = z
  .object({
    contractVersion: z.literal(IPC_CONTRACT_VERSION),
    applied: z.literal(true)
  })
  .strict()

export const commandStateSyncResultSchema = createResultSchema(commandStateSyncSchema)

export const commandInvokedEventSchema = z
  .object({
    contractVersion: z.literal(IPC_CONTRACT_VERSION),
    id: commandIdSchema
  })
  .strict()

export type { CommandId, CommandState }
export type CommandStateSyncRequest = z.infer<typeof commandStateSyncRequestSchema>
export type CommandStateSync = z.infer<typeof commandStateSyncSchema>
export type CommandStateSyncResult = z.infer<typeof commandStateSyncResultSchema>
export type CommandInvokedEvent = z.infer<typeof commandInvokedEventSchema>
