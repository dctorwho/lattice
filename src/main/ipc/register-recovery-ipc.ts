import {
  RECOVERY_DISCARD_CHANNEL,
  RECOVERY_LIST_CHANNEL,
  RECOVERY_WRITE_CHANNEL
} from '../../shared/contracts'
import type { AppInfoDispatch, IpcMainHandleAdapter } from './register-app-info-ipc'

export function registerRecoveryIpc<TEvent>(
  adapter: IpcMainHandleAdapter<TEvent>,
  router: AppInfoDispatch<TEvent>
): () => void {
  const channels = [
    RECOVERY_WRITE_CHANNEL,
    RECOVERY_LIST_CHANNEL,
    RECOVERY_DISCARD_CHANNEL
  ] as const
  for (const channel of channels) {
    adapter.handle(channel, (event, input) => router.dispatch(channel, event, input))
  }
  let removed = false
  return () => {
    if (removed) return
    removed = true
    for (const channel of channels) adapter.removeHandler(channel)
  }
}
