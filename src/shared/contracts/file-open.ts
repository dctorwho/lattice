import { z } from 'zod'

import { createResultSchema } from '../errors'
import { createIpcRequestEnvelopeSchema, emptyPayloadSchema } from './ipc-request'

export const filesOpenRequestSchema = createIpcRequestEnvelopeSchema(emptyPayloadSchema)

export const sourceEncodingSchema = z.enum(['utf8', 'utf8-bom', 'utf16le', 'utf16be'])
export const sourceEolSchema = z.enum(['\n', '\r\n'])

export const diskVersionSchema = z
  .object({
    mtimeMs: z.number().finite(),
    size: z
      .number()
      .int()
      .nonnegative()
      .max(16 * 1024 * 1024),
    contentHash: z.string().regex(/^[a-f0-9]{64}$/u)
  })
  .strict()

const documentIdentitySchema = z.object({
  documentId: z.uuid(),
  path: z.string().min(1).max(32_767),
  bytesHash: z.string().regex(/^[a-f0-9]{64}$/u),
  diskVersion: diskVersionSchema
})

const editableOpenedFileSchema = documentIdentitySchema
  .extend({
    accessMode: z.literal('editable'),
    text: z.string().max(10 * 1024 * 1024),
    encoding: sourceEncodingSchema,
    eolByLine: z.array(sourceEolSchema).max(10 * 1024 * 1024)
  })
  .strict()

const readOnlyOpenedFileSchema = documentIdentitySchema
  .extend({
    accessMode: z.literal('read-only'),
    reason: z.literal('unsupported-encoding')
  })
  .strict()

export const openedFileSchema = z.discriminatedUnion('accessMode', [
  editableOpenedFileSchema,
  readOnlyOpenedFileSchema
])
export const filesOpenResultSchema = createResultSchema(openedFileSchema.nullable())

export type FilesOpenRequest = z.infer<typeof filesOpenRequestSchema>
export type OpenedFile = z.infer<typeof openedFileSchema>
export type FilesOpenResult = z.infer<typeof filesOpenResultSchema>
