import { z } from 'zod'

import { appErrorSchema, type AppError } from './app-error'

export type Result<T, E extends AppError = AppError> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

export function createResultSchema<TValueSchema extends z.ZodType>(valueSchema: TValueSchema) {
  return z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value: valueSchema }).strict(),
    z.object({ ok: z.literal(false), error: appErrorSchema }).strict()
  ])
}
