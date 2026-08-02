import type { AppError, Result } from '../errors'
import type { AppInfo } from './app-info'
import type { CommandId, CommandState, CommandStateSync } from './command'

export interface LatticeDesktopApi {
  readonly app: {
    readonly getInfo: () => Promise<Result<AppInfo, AppError>>
  }
  readonly commands: {
    readonly onInvoke: (listener: (id: CommandId) => void) => () => void
    readonly updateStates: (
      states: readonly CommandState[]
    ) => Promise<Result<CommandStateSync, AppError>>
  }
}
