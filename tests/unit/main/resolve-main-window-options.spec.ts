import { describe, expect, it } from 'vitest'

import { resolveMainWindowOptions } from '../../../src/main/bootstrap/resolve-main-window-options'

describe('main window option resolution', () => {
  it('SEC-001 ignores a forged development renderer URL in packaged mode', () => {
    expect(
      resolveMainWindowOptions({
        currentDirectory: 'C:\\application\\out\\main',
        isPackaged: true,
        electronRendererUrl: 'https://attacker.example/'
      })
    ).toEqual({ currentDirectory: 'C:\\application\\out\\main' })
  })

  it('SEC-001 supplies the renderer URL only in unpackaged development', () => {
    expect(
      resolveMainWindowOptions({
        currentDirectory: 'C:\\application\\out\\main',
        isPackaged: false,
        electronRendererUrl: 'http://127.0.0.1:5173'
      })
    ).toEqual({
      currentDirectory: 'C:\\application\\out\\main',
      developmentRendererUrl: 'http://127.0.0.1:5173'
    })
  })

  it('SEC-001 omits the optional renderer URL when unpackaged development has no URL', () => {
    expect(
      resolveMainWindowOptions({
        currentDirectory: 'C:\\application\\out\\main',
        isPackaged: false
      })
    ).toEqual({ currentDirectory: 'C:\\application\\out\\main' })
  })
})
