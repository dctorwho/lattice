import {
  FILES_CONFIRMED_OVERWRITE_CHANNEL,
  FILES_OPEN_CHANNEL,
  FILES_RELOAD_EXTERNAL_CHANNEL,
  FILES_SAVE_AS_CHANNEL,
  FILES_SAVE_CHANNEL
} from '../../shared/contracts'
import type { AppInfoDispatch, IpcMainHandleAdapter } from './register-app-info-ipc'

export function registerFilesOpenIpc<TEvent>(
  adapter: IpcMainHandleAdapter<TEvent>,
  router: AppInfoDispatch<TEvent>
): () => void {
  adapter.handle(FILES_OPEN_CHANNEL, (event, input) =>
    router.dispatch(FILES_OPEN_CHANNEL, event, input)
  )
  let removed = false
  return () => {
    if (removed) return
    removed = true
    adapter.removeHandler(FILES_OPEN_CHANNEL)
  }
}

export function registerFilesSaveIpc<TEvent>(
  adapter: IpcMainHandleAdapter<TEvent>,
  router: AppInfoDispatch<TEvent>
): () => void {
  const channels = [
    FILES_SAVE_CHANNEL,
    FILES_SAVE_AS_CHANNEL,
    FILES_CONFIRMED_OVERWRITE_CHANNEL,
    FILES_RELOAD_EXTERNAL_CHANNEL
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
