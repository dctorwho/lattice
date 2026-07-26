import { z } from 'zod'

import { ipcContractVersionSchema } from './contract-version'

export const requestIdSchema = z.string().uuid()
export const emptyPayloadSchema = z.object({}).strict()

export function createIpcRequestEnvelopeSchema<TPayloadSchema extends z.ZodType>(
  payloadSchema: TPayloadSchema
) {
  return z
    .object({
      contractVersion: ipcContractVersionSchema,
      requestId: requestIdSchema,
      payload: payloadSchema
    })
    .strict()
}
