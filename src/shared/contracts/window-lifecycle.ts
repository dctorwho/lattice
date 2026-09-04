import { z } from 'zod'

import { createResultSchema } from '../errors'
import { ipcContractVersionSchema } from './contract-version'
import { createIpcRequestEnvelopeSchema } from './ipc-request'

export const windowCloseRequestedEventSchema = z
  .object({ contractVersion: ipcContractVersionSchema })
  .strict()
const windowCloseDecisionPayloadSchema = z
  .object({ decision: z.enum(['close', 'cancel']) })
  .strict()
export const windowCloseDecisionRequestSchema = createIpcRequestEnvelopeSchema(
  windowCloseDecisionPayloadSchema
)
export const windowCloseDecisionResultSchema = createResultSchema(
  z.object({ applied: z.literal(true) }).strict()
)

export type WindowCloseDecisionResult = z.infer<typeof windowCloseDecisionResultSchema>
