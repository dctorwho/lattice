import { COMMAND_UPDATE_STATES_CHANNEL } from '../../shared/contracts'
import type { AppInfoDispatch, IpcMainHandleAdapter } from './register-app-info-ipc'

export function registerCommandStateIpc<TEvent>(
  adapter: IpcMainHandleAdapter<TEvent>,
  router: AppInfoDispatch<TEvent>
): () => void {
  adapter.handle(COMMAND_UPDATE_STATES_CHANNEL, (event, input) =>
    router.dispatch(COMMAND_UPDATE_STATES_CHANNEL, event, input)
  )
  let removed = false
  return () => {
    if (removed) return
    removed = true
    adapter.removeHandler(COMMAND_UPDATE_STATES_CHANNEL)
  }
}
