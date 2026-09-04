import { WINDOW_CLOSE_DECISION_CHANNEL } from '../../shared/contracts'
import type { AppInfoDispatch, IpcMainHandleAdapter } from './register-app-info-ipc'

export function registerWindowLifecycleIpc<TEvent>(
  adapter: IpcMainHandleAdapter<TEvent>,
  router: AppInfoDispatch<TEvent>
): () => void {
  adapter.handle(WINDOW_CLOSE_DECISION_CHANNEL, (event, input) =>
    router.dispatch(WINDOW_CLOSE_DECISION_CHANNEL, event, input)
  )
  let removed = false
  return () => {
    if (removed) return
    removed = true
    adapter.removeHandler(WINDOW_CLOSE_DECISION_CHANNEL)
  }
}
