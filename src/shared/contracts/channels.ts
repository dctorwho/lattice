import { z } from 'zod'

export const APP_GET_INFO_CHANNEL = 'lattice:app:get-info' as const
export const COMMAND_UPDATE_STATES_CHANNEL = 'lattice:commands:update-states' as const
export const COMMAND_INVOKED_CHANNEL = 'lattice:commands:invoked' as const
export const approvedIpcChannelSchema = z.enum([
  APP_GET_INFO_CHANNEL,
  COMMAND_UPDATE_STATES_CHANNEL
])
export type ApprovedIpcChannel = z.infer<typeof approvedIpcChannelSchema>
