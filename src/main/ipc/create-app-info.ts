import { appInfoSchema, IPC_CONTRACT_VERSION, type AppInfo } from '../../shared/contracts'

export interface AppInfoProvider {
  readonly getName: () => string
  readonly getVersion: () => string
  readonly platform: 'win32' | 'darwin' | 'linux'
}

export function createAppInfo(provider: AppInfoProvider): AppInfo {
  const name = provider.getName()
  const version = provider.getVersion()
  const platform = provider.platform

  return appInfoSchema.parse({
    contractVersion: IPC_CONTRACT_VERSION,
    name,
    version,
    platform
  })
}
