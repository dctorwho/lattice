import type { Session } from 'electron'

import { appendContentSecurityPolicy, buildContentSecurityPolicy } from './content-security-policy'

export interface SessionSecurityPolicyTarget {
  setPermissionCheckHandler(handler: () => boolean): void
  setPermissionRequestHandler(
    handler: (
      _webContents: unknown,
      _permission: string,
      callback: (granted: boolean) => void
    ) => void
  ): void
  readonly webRequest: {
    onHeadersReceived(
      handler: (
        details: { readonly responseHeaders?: Readonly<Record<string, readonly string[]>> },
        callback: (response: { readonly responseHeaders: Record<string, string[]> }) => void
      ) => void
    ): void
  }
}

export function installSessionSecurityPolicy(targetSession: Session, development: boolean): void
export function installSessionSecurityPolicy(
  targetSession: SessionSecurityPolicyTarget,
  development: boolean
): void
export function installSessionSecurityPolicy(
  targetSession: SessionSecurityPolicyTarget,
  development: boolean
): void {
  targetSession.setPermissionCheckHandler(() => false)
  targetSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })

  const policy = buildContentSecurityPolicy(development)
  targetSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: appendContentSecurityPolicy(details.responseHeaders, policy)
    })
  })
}
