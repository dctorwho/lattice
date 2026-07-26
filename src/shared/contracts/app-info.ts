import { z } from 'zod'

import { createResultSchema } from '../errors'
import { IPC_CONTRACT_VERSION } from './contract-version'
import { createIpcRequestEnvelopeSchema, emptyPayloadSchema } from './ipc-request'

const boundedPrintableTextSchema = z
  .string()
  .min(1)
  .max(64)
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value))

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
