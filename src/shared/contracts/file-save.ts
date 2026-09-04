import { z } from 'zod'

import { createResultSchema } from '../errors'
import { createIpcRequestEnvelopeSchema } from './ipc-request'
import { diskVersionSchema, sourceEncodingSchema, sourceEolSchema } from './file-open'

const documentSaveSnapshotShape = {
  documentId: z.uuid(),
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  text: z.string().max(10 * 1024 * 1024),
  encoding: sourceEncodingSchema,
  eolByLine: z.array(sourceEolSchema).max(10 * 1024 * 1024)
} as const

function validateEolIndex(
  value: { readonly text: string; readonly eolByLine: readonly string[] },
  context: z.RefinementCtx
): void {
  let lineBreaks = 0
  for (const character of value.text) {
    if (character === '\n') lineBreaks += 1
  }
  if (value.text.includes('\r') || value.eolByLine.length !== lineBreaks) {
    context.addIssue({
      code: 'custom',
      path: ['eolByLine'],
      message: 'eolByLine must exactly index normalized LF text'
    })
  }
}

const documentSaveSnapshotSchema = z
  .object(documentSaveSnapshotShape)
  .strict()
  .superRefine(validateEolIndex)

const filesSavePayloadSchema = z
  .object({
    ...documentSaveSnapshotShape,
    path: z.string().min(1).max(32_767),
    expectedDiskVersion: diskVersionSchema
  })
  .strict()
  .superRefine(validateEolIndex)

const filesConfirmedOverwritePayloadSchema = z
  .object({ ...documentSaveSnapshotShape, conflictToken: z.uuid() })
  .strict()
  .superRefine(validateEolIndex)

export const filesSaveRequestSchema = createIpcRequestEnvelopeSchema(filesSavePayloadSchema)
export const filesSaveAsRequestSchema = createIpcRequestEnvelopeSchema(documentSaveSnapshotSchema)
export const filesConfirmedOverwriteRequestSchema = createIpcRequestEnvelopeSchema(
  filesConfirmedOverwritePayloadSchema
)

export const savedFileSchema = z
  .object({
    path: z.string().min(1).max(32_767),
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    diskVersion: diskVersionSchema,
    bytesHash: z.string().regex(/^[a-f0-9]{64}$/u)
  })
  .strict()

export const editableExternalFileSchema = z
  .object({
    accessMode: z.literal('editable'),
    text: z.string().max(10 * 1024 * 1024),
    encoding: sourceEncodingSchema,
    eolByLine: z.array(sourceEolSchema).max(10 * 1024 * 1024),
    bytesHash: z.string().regex(/^[a-f0-9]{64}$/u),
    diskVersion: diskVersionSchema
  })
  .strict()

export const readOnlyExternalFileSchema = z
  .object({
    accessMode: z.literal('read-only'),
    reason: z.literal('unsupported-encoding'),
    bytesHash: z.string().regex(/^[a-f0-9]{64}$/u),
    diskVersion: diskVersionSchema
  })
  .strict()

export const fileSaveOutcomeSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('saved'), file: savedFileSchema }).strict(),
  z
    .object({
      status: z.literal('conflict'),
      conflictToken: z.uuid(),
      external: z.discriminatedUnion('accessMode', [
        editableExternalFileSchema,
        readOnlyExternalFileSchema
      ])
    })
    .strict()
])

export const filesSaveResultSchema = createResultSchema(fileSaveOutcomeSchema)
export const filesSaveAsResultSchema = createResultSchema(fileSaveOutcomeSchema.nullable())
export const filesConfirmedOverwriteResultSchema = createResultSchema(fileSaveOutcomeSchema)

export type DocumentSaveSnapshot = z.infer<typeof documentSaveSnapshotSchema>
export type SavedFile = z.infer<typeof savedFileSchema>
export type FilesSaveRequest = z.infer<typeof filesSaveRequestSchema>
export type FilesSaveAsRequest = z.infer<typeof filesSaveAsRequestSchema>
export type FilesConfirmedOverwriteRequest = z.infer<typeof filesConfirmedOverwriteRequestSchema>
export type FileSaveOutcome = z.infer<typeof fileSaveOutcomeSchema>
export type FilesSaveResult = z.infer<typeof filesSaveResultSchema>
export type FilesSaveAsResult = z.infer<typeof filesSaveAsResultSchema>
export type FilesConfirmedOverwriteResult = z.infer<typeof filesConfirmedOverwriteResultSchema>
