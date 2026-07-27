import { z } from 'zod'

import { createResultSchema } from '../errors'
import { IPC_CONTRACT_VERSION } from './contract-version'
import { createIpcRequestEnvelopeSchema, emptyPayloadSchema } from './ipc-request'

function containsControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const characterCode = value.charCodeAt(index)
    if (characterCode <= 0x1f || characterCode === 0x7f) {
      return true
    }
  }

  return false
}

const boundedPrintableTextSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => !containsControlCharacter(value))

export const appInfoSchema = z
  .object({
    contractVersion: z.literal(IPC_CONTRACT_VERSION),
    name: boundedPrintableTextSchema,
    version: boundedPrintableTextSchema,
    platform: z.enum(['win32', 'darwin', 'linux'])
  })
  .strict()

export const appGetInfoRequestSchema = createIpcRequestEnvelopeSchema(emptyPayloadSchema)
export const appGetInfoResultSchema = createResultSchema(appInfoSchema)

export type AppInfo = z.infer<typeof appInfoSchema>
export type AppGetInfoRequest = z.infer<typeof appGetInfoRequestSchema>
export type AppGetInfoResult = z.infer<typeof appGetInfoResultSchema>
