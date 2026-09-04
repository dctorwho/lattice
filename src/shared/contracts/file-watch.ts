import { z } from 'zod'

import { createResultSchema } from '../errors'
import { ipcContractVersionSchema } from './contract-version'
import { createIpcRequestEnvelopeSchema } from './ipc-request'
import { diskVersionSchema } from './file-open'
import { editableExternalFileSchema, readOnlyExternalFileSchema } from './file-save'

export const filesExternalChangeEventSchema = z.discriminatedUnion('kind', [
  z
    .object({
      contractVersion: ipcContractVersionSchema,
      kind: z.literal('changed'),
      documentId: z.uuid(),
      path: z.string().min(1).max(32_767),
      external: z.discriminatedUnion('accessMode', [
        editableExternalFileSchema,
        readOnlyExternalFileSchema
      ])
    })
    .strict(),
  z
    .object({
      contractVersion: ipcContractVersionSchema,
      kind: z.literal('deleted'),
      documentId: z.uuid(),
      path: z.string().min(1).max(32_767)
    })
    .strict()
])

export type FilesExternalChangeEvent = z.infer<typeof filesExternalChangeEventSchema>

const filesReloadExternalPayloadSchema = z
  .object({
    documentId: z.uuid(),
    path: z.string().min(1).max(32_767),
    expectedDiskVersion: diskVersionSchema
  })
  .strict()

const reloadedExternalFileSchema = editableExternalFileSchema
  .extend({
    documentId: z.uuid(),
    path: z.string().min(1).max(32_767),
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
  })
  .strict()

export const filesReloadExternalRequestSchema = createIpcRequestEnvelopeSchema(
  filesReloadExternalPayloadSchema
)
export const filesReloadExternalResultSchema = createResultSchema(reloadedExternalFileSchema)

export type FilesReloadExternalRequest = z.infer<typeof filesReloadExternalRequestSchema>
export type FilesReloadExternalResult = z.infer<typeof filesReloadExternalResultSchema>
export type ReloadedExternalFile = z.infer<typeof reloadedExternalFileSchema>
