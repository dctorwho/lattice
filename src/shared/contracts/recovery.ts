import { z } from 'zod'

import { createResultSchema } from '../errors'
import { diskVersionSchema, sourceEncodingSchema, sourceEolSchema } from './file-open'
import { createIpcRequestEnvelopeSchema, emptyPayloadSchema } from './ipc-request'

const revisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)

const recoverySnapshotBaseSchema = z
  .object({
    documentId: z.uuid(),
    path: z.string().min(1).max(32_767).nullable(),
    revision: revisionSchema,
    currentContentRevision: revisionSchema,
    savedRevision: revisionSchema,
    text: z.string().max(10 * 1024 * 1024),
    encoding: sourceEncodingSchema,
    eolByLine: z.array(sourceEolSchema).max(10 * 1024 * 1024),
    originalBytesHash: z.string().regex(/^[a-f0-9]{64}$/u),
    diskVersion: diskVersionSchema.nullable(),
    trigger: z.enum(['typing', 'structural', 'close'])
  })
  .strict()

function validateRecoveryMetadata(
  value: {
    readonly text: string
    readonly eolByLine: readonly string[]
    readonly currentContentRevision: number
    readonly savedRevision: number
    readonly revision: number
  },
  context: z.RefinementCtx
): void {
  const lineBreaks = [...value.text].filter((character) => character === '\n').length
  if (
    value.text.includes('\r') ||
    value.eolByLine.length !== lineBreaks ||
    value.currentContentRevision > value.revision ||
    value.savedRevision > value.revision
  ) {
    context.addIssue({ code: 'custom', message: 'Recovery snapshot metadata is inconsistent' })
  }
}

const recoverySnapshotSchema = recoverySnapshotBaseSchema.superRefine(validateRecoveryMetadata)

const recoveryRecordSchema = recoverySnapshotBaseSchema
  .omit({ trigger: true })
  .extend({ createdAtMs: z.number().int().nonnegative() })
  .strict()
  .superRefine(validateRecoveryMetadata)

const discardRecoveryPayloadSchema = z.object({ documentId: z.uuid() }).strict()
const appliedSchema = z.object({ applied: z.literal(true) }).strict()

export const recoveryWriteRequestSchema = createIpcRequestEnvelopeSchema(recoverySnapshotSchema)
export const recoveryWriteResultSchema = createResultSchema(appliedSchema)
export const recoveryListRequestSchema = createIpcRequestEnvelopeSchema(emptyPayloadSchema)
export const recoveryListResultSchema = createResultSchema(z.array(recoveryRecordSchema))
export const recoveryDiscardRequestSchema = createIpcRequestEnvelopeSchema(
  discardRecoveryPayloadSchema
)
export const recoveryDiscardResultSchema = createResultSchema(appliedSchema)

export type RecoverySnapshot = z.infer<typeof recoverySnapshotSchema>
export type RecoveryRecord = z.infer<typeof recoveryRecordSchema>
export type RecoveryWriteResult = z.infer<typeof recoveryWriteResultSchema>
export type RecoveryListResult = z.infer<typeof recoveryListResultSchema>
export type RecoveryDiscardResult = z.infer<typeof recoveryDiscardResultSchema>
