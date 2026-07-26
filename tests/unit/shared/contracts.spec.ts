import { describe, expect, it } from 'vitest'

import {
  APP_GET_INFO_CHANNEL,
  IPC_CONTRACT_VERSION,
  appGetInfoRequestSchema,
  appGetInfoResultSchema,
  appInfoSchema,
  approvedIpcChannelSchema
} from '../../../src/shared/contracts'
import { appErrorSchema, createAppError, errorCodeSchema } from '../../../src/shared/errors'

const requestId = '00000000-0000-4000-8000-000000000001'

describe('TC-M0-005 shared contracts', () => {
  it('accepts the exact getInfo request and response', () => {
    expect(
      appGetInfoRequestSchema.parse({
        contractVersion: IPC_CONTRACT_VERSION,
        requestId,
        payload: {}
      })
    ).toEqual({ contractVersion: 1, requestId, payload: {} })

    expect(
      appGetInfoResultSchema.parse({
        ok: true,
        value: {
          contractVersion: 1,
          name: 'Lattice',
          version: '0.0.0',
          platform: 'win32'
        }
      })
    ).toEqual({
      ok: true,
      value: {
        contractVersion: 1,
        name: 'Lattice',
        version: '0.0.0',
        platform: 'win32'
      }
    })
  })

  it.each([
    {},
    { contractVersion: 1, requestId, payload: {}, extra: true },
    { contractVersion: 1, payload: {} },
    { contractVersion: 1, requestId: 'not-a-uuid', payload: {} },
    { contractVersion: 2, requestId, payload: {} },
    { contractVersion: 1, requestId, payload: { extra: true } }
  ])('rejects an invalid getInfo envelope: %o', (value) => {
    expect(appGetInfoRequestSchema.safeParse(value).success).toBe(false)
  })

  it.each([
    { contractVersion: 1, name: '', version: '0.0.0', platform: 'win32' },
    { contractVersion: 1, name: 'A'.repeat(65), version: '0.0.0', platform: 'win32' },
    { contractVersion: 1, name: 'Lat\u0000tice', version: '0.0.0', platform: 'win32' },
    { contractVersion: 1, name: 'Lattice', version: '', platform: 'win32' },
    { contractVersion: 1, name: 'Lattice', version: '0.0.0', platform: 'android' }
  ])('rejects invalid AppInfo: %o', (value) => {
    expect(appInfoSchema.safeParse(value).success).toBe(false)
  })

  it.each([
    ['win32', { contractVersion: 1, name: 'Lattice', version: '0.0.0', platform: 'win32' }],
    ['darwin', { contractVersion: 1, name: 'Lattice', version: '0.0.0', platform: 'darwin' }],
    ['linux', { contractVersion: 1, name: 'Lattice', version: '0.0.0', platform: 'linux' }]
  ])('accepts the exact supported platform value: %s', (_platform, value) => {
    expect(appInfoSchema.parse(value)).toEqual(value)
  })

  it('restricts channels and stable error codes', () => {
    expect(approvedIpcChannelSchema.parse(APP_GET_INFO_CHANNEL)).toBe('lattice:app:get-info')
    expect(approvedIpcChannelSchema.safeParse('lattice:invoke').success).toBe(false)
    expect(errorCodeSchema.safeParse('FILE_NOT_FOUND').success).toBe(false)
    expect(errorCodeSchema.safeParse('IPC_INVALID_REQUEST').success).toBe(true)
  })

  it.each([
    ['IPC_INVALID_REQUEST', 'IPC_INVALID_REQUEST'],
    ['IPC_UNAUTHORIZED_SENDER', 'IPC_UNAUTHORIZED_SENDER'],
    ['APP_VERSION_MISMATCH', 'APP_VERSION_MISMATCH'],
    ['INTERNAL_UNEXPECTED', 'INTERNAL_UNEXPECTED']
  ])('parses the exact active error code: %s', (_name, value) => {
    expect(errorCodeSchema.parse(value)).toBe(value)
  })

  it('builds a bounded AppError with a stable message key and request ID', () => {
    expect(
      createAppError('IPC_INVALID_REQUEST', requestId, {
        reason: 'schema_invalid'
      })
    ).toEqual({
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.ipc.invalidRequest',
      retryable: false,
      safeDetails: { reason: 'schema_invalid' },
      requestId
    })
  })

  it.each([
    { code: 'IPC_INVALID_REQUEST', messageKey: 'raw message', retryable: false },
    {
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.ipc.invalidRequest',
      retryable: false,
      safeDetails: { path: { nested: true } }
    },
    {
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.ipc.invalidRequest',
      retryable: false,
      safeDetails: { path: 'D:\\private\\draft.md' }
    },
    {
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.internal.unexpected',
      retryable: false
    },
    {
      code: 'IPC_INVALID_REQUEST',
      messageKey: 'errors.ipc.invalidRequest',
      retryable: false,
      unexpected: true
    }
  ])('rejects unsafe AppError shapes: %o', (value) => {
    expect(appErrorSchema.safeParse(value).success).toBe(false)
  })
})
