import { describe, expect, it } from 'vitest'
import type { SessionSecurityPolicyTarget } from '../../../src/main/security/session-security-policy'
import { installSessionSecurityPolicy } from '../../../src/main/security/session-security-policy'

import {
  appendContentSecurityPolicy,
  buildContentSecurityPolicy
} from '../../../src/main/security/content-security-policy'

const productionPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "child-src 'none'",
  "connect-src 'none'",
  "font-src 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self'"
].join('; ')

function createSessionTarget(): {
  readonly target: SessionSecurityPolicyTarget
  readonly getPermissionCheckHandler: () => (() => boolean) | undefined
  readonly getPermissionRequestHandler: () =>
    | ((_webContents: unknown, _permission: string, callback: (granted: boolean) => void) => void)
    | undefined
  readonly getHeadersReceivedHandler: () =>
    | ((
        details: { readonly responseHeaders?: Readonly<Record<string, readonly string[]>> },
        callback: (response: { readonly responseHeaders: Record<string, string[]> }) => void
      ) => void)
    | undefined
} {
  let permissionCheckHandler: (() => boolean) | undefined
  let permissionRequestHandler:
    | ((_webContents: unknown, _permission: string, callback: (granted: boolean) => void) => void)
    | undefined
  let headersReceivedHandler:
    | ((
        details: { readonly responseHeaders?: Readonly<Record<string, readonly string[]>> },
        callback: (response: { readonly responseHeaders: Record<string, string[]> }) => void
      ) => void)
    | undefined

  return {
    target: {
      setPermissionCheckHandler: (handler) => {
        permissionCheckHandler = handler
      },
      setPermissionRequestHandler: (handler) => {
        permissionRequestHandler = handler
      },
      webRequest: {
        onHeadersReceived: (handler) => {
          headersReceivedHandler = handler
        }
      }
    },
    getPermissionCheckHandler: () => permissionCheckHandler,
    getPermissionRequestHandler: () => permissionRequestHandler,
    getHeadersReceivedHandler: () => headersReceivedHandler
  }
}

describe('content security policy', () => {
  it('SEC-003 returns the exact production policy that blocks remote content', () => {
    expect(buildContentSecurityPolicy(false)).toBe(productionPolicy)
  })

  it('SEC-003 changes only connect-src for the development server', () => {
    expect(buildContentSecurityPolicy(true)).toBe(
      productionPolicy.replace(
        "connect-src 'none'",
        "connect-src 'self' ws://localhost:* ws://127.0.0.1:*"
      )
    )
  })

  it('SEC-003 preserves non-CSP headers and replaces stale CSP values', () => {
    const responseHeaders = {
      'X-Content-Type-Options': ['nosniff'],
      'content-security-policy': ['default-src *', "script-src 'unsafe-inline'"],
      'CONTENT-SECURITY-POLICY': ['img-src *']
    }

    expect(appendContentSecurityPolicy(responseHeaders, productionPolicy)).toEqual({
      'X-Content-Type-Options': ['nosniff'],
      'Content-Security-Policy': [productionPolicy]
    })
  })

  it('SEC-003 denies session permissions and injects the production CSP at the response boundary', () => {
    const session = createSessionTarget()
    installSessionSecurityPolicy(session.target, false)

    expect(session.getPermissionCheckHandler()!()).toBe(false)

    const requestedPermissions: boolean[] = []
    session.getPermissionRequestHandler()!(null, 'geolocation', (granted) => {
      requestedPermissions.push(granted)
    })
    expect(requestedPermissions).toEqual([false])

    let responseHeaders: Record<string, string[]> | undefined
    session.getHeadersReceivedHandler()!(
      { responseHeaders: { 'X-Content-Type-Options': ['nosniff'] } },
      (response) => {
        responseHeaders = response.responseHeaders
      }
    )
    expect(responseHeaders).toEqual({
      'X-Content-Type-Options': ['nosniff'],
      'Content-Security-Policy': [productionPolicy]
    })
  })
})
