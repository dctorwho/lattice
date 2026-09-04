import { z } from 'zod'

export const errorCodes = [
  'IPC_INVALID_REQUEST',
  'IPC_UNAUTHORIZED_SENDER',
  'APP_VERSION_MISMATCH',
  'FILE_NOT_FOUND',
  'FILE_PERMISSION_DENIED',
  'FILE_UNSUPPORTED_ENCODING',
  'FILE_CHANGED_EXTERNALLY',
  'FILE_DELETED_EXTERNALLY',
  'FILE_ATOMIC_SAVE_FAILED',
  'FILE_PATH_TOO_LONG',
  'DOCUMENT_STALE_PATCH',
  'DOCUMENT_READ_ONLY',
  'RECOVERY_WRITE_FAILED',
  'RECOVERY_CORRUPT',
  'SEARCH_INVALID_PATTERN',
  'INTERNAL_UNEXPECTED'
] as const

export const errorCodeSchema = z.enum(errorCodes)
export type ErrorCode = z.infer<typeof errorCodeSchema>

export const errorMessageKeys = {
  IPC_INVALID_REQUEST: 'errors.ipc.invalidRequest',
  IPC_UNAUTHORIZED_SENDER: 'errors.ipc.unauthorizedSender',
  APP_VERSION_MISMATCH: 'errors.app.versionMismatch',
  FILE_NOT_FOUND: 'errors.file.notFound',
  FILE_PERMISSION_DENIED: 'errors.file.permissionDenied',
  FILE_UNSUPPORTED_ENCODING: 'errors.file.unsupportedEncoding',
  FILE_CHANGED_EXTERNALLY: 'errors.file.changedExternally',
  FILE_DELETED_EXTERNALLY: 'errors.file.deletedExternally',
  FILE_ATOMIC_SAVE_FAILED: 'errors.file.atomicSaveFailed',
  FILE_PATH_TOO_LONG: 'errors.file.pathTooLong',
  DOCUMENT_STALE_PATCH: 'errors.document.stalePatch',
  DOCUMENT_READ_ONLY: 'errors.document.readOnly',
  RECOVERY_WRITE_FAILED: 'errors.recovery.writeFailed',
  RECOVERY_CORRUPT: 'errors.recovery.corrupt',
  SEARCH_INVALID_PATTERN: 'errors.search.invalidPattern',
  INTERNAL_UNEXPECTED: 'errors.internal.unexpected'
} as const satisfies Readonly<Record<ErrorCode, string>>

export const errorRetryable = {
  IPC_INVALID_REQUEST: false,
  IPC_UNAUTHORIZED_SENDER: false,
  APP_VERSION_MISMATCH: false,
  FILE_NOT_FOUND: false,
  FILE_PERMISSION_DENIED: false,
  FILE_UNSUPPORTED_ENCODING: false,
  FILE_CHANGED_EXTERNALLY: false,
  FILE_DELETED_EXTERNALLY: false,
  FILE_ATOMIC_SAVE_FAILED: true,
  FILE_PATH_TOO_LONG: false,
  DOCUMENT_STALE_PATCH: false,
  DOCUMENT_READ_ONLY: false,
  RECOVERY_WRITE_FAILED: true,
  RECOVERY_CORRUPT: false,
  SEARCH_INVALID_PATTERN: false,
  INTERNAL_UNEXPECTED: false
} as const satisfies Readonly<Record<ErrorCode, boolean>>
