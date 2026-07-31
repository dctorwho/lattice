import type { LatticeDesktopApi } from '../../shared/contracts'

declare global {
  interface Window {
    readonly lattice: LatticeDesktopApi
  }
}

export {}
