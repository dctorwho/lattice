import { z } from 'zod'

import { errorCodeSchema, errorMessageKeys, errorRetryable, type ErrorCode } from './error-code'

export const ipcSafeReasonSchema = z.enum([
  'unknown_channel',
  'contract_version_mismatch',
  'schema_invalid',
  'missing_sender_frame',
  'sender_destroyed',
  'subframe_sender',
  'window_not_registered',
  'sender_identity_mismatch',
  'window_destroyed',
  'unsupported_type',
  'non_finite_number',
  'character_budget_exceeded',
  'depth_exceeded',
  'entry_budget_exceeded',
  'symbol_key',
  'accessor',
  'non_plain_object',
  'cycle',
  'handler_threw',
  'response_schema_invalid'
])

export const safeDetailsSchema = z
  .object({
    reason: ipcSafeReasonSchema.optional(),
    expectedVersion: z.literal(1).optional(),
    receivedVersion: z.number().int().min(0).max(1_000).optional()
  })
  .strict()

export const appErrorSchema = z
  .object({
    code: errorCodeSchema,
    messageKey: z.enum(Object.values(errorMessageKeys)),
    retryable: z.boolean(),
    safeDetails: safeDetailsSchema.optional(),
    requestId: z.string().uuid().optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.messageKey !== errorMessageKeys[value.code]) {
      context.addIssue({
        code: 'custom',
        path: ['messageKey'],
        message: 'messageKey must match code'
      })
    }
    if (value.retryable !== errorRetryable[value.code]) {
      context.addIssue({
        code: 'custom',
        path: ['retryable'],
        message: 'retryable must match code'
      })
    }
  })

export type SafeDetails = z.infer<typeof safeDetailsSchema>
export type IpcSafeReason = z.infer<typeof ipcSafeReasonSchema>
export type AppError = z.infer<typeof appErrorSchema>

export function createAppError(
  code: ErrorCode,
  requestId: string,
  safeDetails?: SafeDetails
): AppError {
  const base = {
    code,
    messageKey: errorMessageKeys[code],
    retryable: errorRetryable[code],
    requestId
  } as const
  return appErrorSchema.parse(safeDetails === undefined ? base : { ...base, safeDetails })
}
