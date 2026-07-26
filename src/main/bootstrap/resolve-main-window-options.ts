import type { CreateMainWindowOptions } from './create-main-window'

export interface ResolveMainWindowOptions {
  readonly currentDirectory: string
  readonly isPackaged: boolean
  readonly electronRendererUrl?: string
}

export function resolveMainWindowOptions(
  options: ResolveMainWindowOptions
): CreateMainWindowOptions {
  if (options.isPackaged || options.electronRendererUrl === undefined) {
    return { currentDirectory: options.currentDirectory }
  }

  return {
    currentDirectory: options.currentDirectory,
    developmentRendererUrl: options.electronRendererUrl
  }
}
