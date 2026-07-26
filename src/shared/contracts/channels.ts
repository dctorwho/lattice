import { z } from 'zod'

export const APP_GET_INFO_CHANNEL = 'lattice:app:get-info' as const
export const approvedIpcChannelSchema = z.enum([APP_GET_INFO_CHANNEL])
export type ApprovedIpcChannel = z.infer<typeof approvedIpcChannelSchema>
