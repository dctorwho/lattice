import { z } from 'zod'

export const errorCodes = [
  'IPC_INVALID_REQUEST',
  'IPC_UNAUTHORIZED_SENDER',
  'APP_VERSION_MISMATCH',
  'INTERNAL_UNEXPECTED'
] as const

export const errorCodeSchema = z.enum(errorCodes)
export type ErrorCode = z.infer<typeof errorCodeSchema>

export const errorMessageKeys = {
  IPC_INVALID_REQUEST: 'errors.ipc.invalidRequest',
  IPC_UNAUTHORIZED_SENDER: 'errors.ipc.unauthorizedSender',
  APP_VERSION_MISMATCH: 'errors.app.versionMismatch',
  INTERNAL_UNEXPECTED: 'errors.internal.unexpected'
} as const satisfies Readonly<Record<ErrorCode, string>>
