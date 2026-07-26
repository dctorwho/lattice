import { describe, expect, expectTypeOf, it } from 'vitest'
import type { Session } from 'electron'
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

type PermissionCheckHandler = Parameters<Session['setPermissionCheckHandler']>[0]
type PermissionRequestHandler = Parameters<Session['setPermissionRequestHandler']>[0]
type HeadersReceivedHandler = Parameters<Session['webRequest']['onHeadersReceived']>[0]
type ElectronSessionSecurityPolicyTarget = Pick<
  Session,
  'setPermissionCheckHandler' | 'setPermissionRequestHandler'
> & {
  readonly webRequest: Pick<Session['webRequest'], 'onHeadersReceived'>
}

function isRegistered<T>(handler: T): handler is NonNullable<T> {
  return handler !== null && handler !== undefined
}

function requireHandler<T>(handler: T, name: string): NonNullable<T> {
  if (!isRegistered(handler)) {
    throw new Error(`${name} was not registered`)
  }
  return handler
}

function createSessionTarget(): {
  readonly target: SessionSecurityPolicyTarget
  readonly getPermissionCheckHandler: () => PermissionCheckHandler
  readonly getPermissionRequestHandler: () => PermissionRequestHandler
  readonly getHeadersReceivedHandler: () => HeadersReceivedHandler
} {
  let permissionCheckHandler: PermissionCheckHandler = null
  let permissionRequestHandler: PermissionRequestHandler = null
  let headersReceivedHandler: HeadersReceivedHandler = null

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
          if (typeof handler === 'function' || handler === null) {
            headersReceivedHandler = handler
          }
        }
      }
    },
    getPermissionCheckHandler: () => permissionCheckHandler,
    getPermissionRequestHandler: () => permissionRequestHandler,
    getHeadersReceivedHandler: () => headersReceivedHandler
  }
}

describe('content security policy', () => {
  it('SEC-003 derives the session target from Electron session APIs', () => {
    expectTypeOf<SessionSecurityPolicyTarget>().toEqualTypeOf<ElectronSessionSecurityPolicyTarget>()
  })

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

    const permissionCheckHandler = requireHandler(
      session.getPermissionCheckHandler(),
      'permission check handler'
    )
    expect(Reflect.apply(permissionCheckHandler, undefined, [])).toBe(false)

    const requestedPermissions: boolean[] = []
    const permissionRequestHandler = requireHandler(
      session.getPermissionRequestHandler(),
      'permission request handler'
    )
    Reflect.apply(permissionRequestHandler, undefined, [
      null,
      'geolocation',
      (granted: boolean) => {
        requestedPermissions.push(granted)
      }
    ])
    expect(requestedPermissions).toEqual([false])

    let responseHeaders: Record<string, string[]> | undefined
    const headersReceivedHandler = requireHandler(
      session.getHeadersReceivedHandler(),
      'headers received handler'
    )
    Reflect.apply(headersReceivedHandler, undefined, [
      { responseHeaders: { 'X-Content-Type-Options': ['nosniff'] } },
      (response: { readonly responseHeaders: Record<string, string[]> }) => {
        responseHeaders = response.responseHeaders
      }
    ])
    expect(responseHeaders).toEqual({
      'X-Content-Type-Options': ['nosniff'],
      'Content-Security-Policy': [productionPolicy]
    })
  })
})
