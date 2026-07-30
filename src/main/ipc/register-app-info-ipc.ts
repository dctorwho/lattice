import { APP_GET_INFO_CHANNEL, type ApprovedIpcChannel } from '../../shared/contracts'

export interface IpcMainHandleAdapter<TEvent> {
  readonly handle: (
    channel: ApprovedIpcChannel,
    listener: (event: TEvent, input: unknown) => Promise<unknown>
  ) => void
  readonly removeHandler: (channel: ApprovedIpcChannel) => void
}

export interface AppInfoDispatch<TEvent> {
  readonly dispatch: (channel: string, event: TEvent, input: unknown) => Promise<unknown>
}

export function registerAppInfoIpc<TEvent>(
  adapter: IpcMainHandleAdapter<TEvent>,
  router: AppInfoDispatch<TEvent>
): () => void {
  adapter.handle(APP_GET_INFO_CHANNEL, (event, input) =>
    router.dispatch(APP_GET_INFO_CHANNEL, event, input)
  )
  let removed = false
  return () => {
    if (!removed) {
      removed = true
      adapter.removeHandler(APP_GET_INFO_CHANNEL)
    }
  }
}
