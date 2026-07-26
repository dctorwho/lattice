import type { AppError, Result } from '../errors'
import type { AppInfo } from './app-info'

export interface LatticeDesktopApi {
  readonly app: {
    readonly getInfo: () => Promise<Result<AppInfo, AppError>>
  }
}
