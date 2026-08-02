import type { CreateMainWindowOptions } from './create-main-window'

export interface ApplicationCompositionDependencies<TContents> {
  readonly platform: NodeJS.Platform
  readonly enableSandbox: () => void
  readonly registerWebContentsCreated: (listener: (contents: TContents) => void) => void
  readonly whenReady: () => Promise<void>
  readonly installWebContentsSecurityPolicy: (contents: TContents) => void
  readonly installSessionSecurityPolicy: (development: boolean) => void
  readonly installApplicationMenu: () => void
  readonly createMainWindow: (options: CreateMainWindowOptions) => void
  readonly registerActivate: (listener: () => void) => void
  readonly hasOpenWindows: () => boolean
  readonly registerWindowAllClosed: (listener: () => void) => void
  readonly quit: () => void
}

export function composeApplication<TContents>(
  mainWindowOptions: CreateMainWindowOptions,
  dependencies: ApplicationCompositionDependencies<TContents>
): void {
  dependencies.enableSandbox()

  dependencies.registerWebContentsCreated((contents) => {
    dependencies.installWebContentsSecurityPolicy(contents)
  })

  void dependencies.whenReady().then(() => {
    dependencies.installSessionSecurityPolicy(
      mainWindowOptions.developmentRendererUrl !== undefined
    )
    dependencies.installApplicationMenu()
    dependencies.createMainWindow(mainWindowOptions)

    dependencies.registerActivate(() => {
      if (!dependencies.hasOpenWindows()) {
        dependencies.createMainWindow(mainWindowOptions)
      }
    })
  })

  dependencies.registerWindowAllClosed(() => {
    if (dependencies.platform !== 'darwin') dependencies.quit()
  })
}
