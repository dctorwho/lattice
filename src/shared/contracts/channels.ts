import { z } from 'zod'

export const APP_GET_INFO_CHANNEL = 'lattice:app:get-info' as const
export const FILES_OPEN_CHANNEL = 'lattice:files:open' as const
export const FILES_SAVE_CHANNEL = 'lattice:files:save' as const
export const FILES_SAVE_AS_CHANNEL = 'lattice:files:save-as' as const
export const FILES_CONFIRMED_OVERWRITE_CHANNEL = 'lattice:files:confirmed-overwrite' as const
export const FILES_RELOAD_EXTERNAL_CHANNEL = 'lattice:files:reload-external' as const
export const RECOVERY_WRITE_CHANNEL = 'lattice:recovery:write' as const
export const RECOVERY_LIST_CHANNEL = 'lattice:recovery:list' as const
export const RECOVERY_DISCARD_CHANNEL = 'lattice:recovery:discard' as const
export const WINDOW_CLOSE_DECISION_CHANNEL = 'lattice:window:close-decision' as const
export const WINDOW_CLOSE_REQUESTED_EVENT = 'lattice:window:close-requested' as const
export const FILES_EXTERNAL_CHANGE_EVENT = 'lattice:files:external-change' as const
export const COMMAND_UPDATE_STATES_CHANNEL = 'lattice:commands:update-states' as const
export const COMMAND_INVOKED_CHANNEL = 'lattice:commands:invoked' as const
export const approvedIpcChannelSchema = z.enum([
  APP_GET_INFO_CHANNEL,
  FILES_OPEN_CHANNEL,
  FILES_SAVE_CHANNEL,
  FILES_SAVE_AS_CHANNEL,
  FILES_CONFIRMED_OVERWRITE_CHANNEL,
  FILES_RELOAD_EXTERNAL_CHANNEL,
  RECOVERY_WRITE_CHANNEL,
  RECOVERY_LIST_CHANNEL,
  RECOVERY_DISCARD_CHANNEL,
  WINDOW_CLOSE_DECISION_CHANNEL,
  COMMAND_UPDATE_STATES_CHANNEL
])
export type ApprovedIpcChannel = z.infer<typeof approvedIpcChannelSchema>
