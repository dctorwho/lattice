const staticDirectives = [
  "default-src 'self'",
  "base-uri 'none'",
  "child-src 'none'",
  "font-src 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "img-src 'self' data:",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'"
] as const

export function buildContentSecurityPolicy(development: boolean): string {
  const connectSource = development
    ? "connect-src 'self' ws://localhost:* ws://127.0.0.1:*"
    : "connect-src 'none'"

  return [
    staticDirectives[0],
    staticDirectives[1],
    staticDirectives[2],
    connectSource,
    ...staticDirectives.slice(3)
  ].join('; ')
}

export function appendContentSecurityPolicy(
  responseHeaders: Readonly<Record<string, readonly string[]>> | undefined,
  policy: string
): Record<string, string[]> {
  const nextHeaders: Record<string, string[]> = {}

  for (const [name, values] of Object.entries(responseHeaders ?? {})) {
    if (name.toLowerCase() !== 'content-security-policy') {
      nextHeaders[name] = [...values]
    }
  }

  nextHeaders['Content-Security-Policy'] = [policy]
  return nextHeaders
}
