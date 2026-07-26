import type { Session } from 'electron'

import { appendContentSecurityPolicy, buildContentSecurityPolicy } from './content-security-policy'

export type SessionSecurityPolicyTarget = Pick<
  Session,
  'setPermissionCheckHandler' | 'setPermissionRequestHandler'
> & {
  readonly webRequest: Pick<Session['webRequest'], 'onHeadersReceived'>
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
