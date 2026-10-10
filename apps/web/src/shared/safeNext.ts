const BASE = 'https://sheetloop.invalid'

/**
 * Where to go after sign-in: a path on this site, else the home page. The path is resolved the
 * way the browser will, so "//evil.example" or "/\evil.example" (a backslash counts as a slash)
 * cannot send the person to another site.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== 'string' || !next.startsWith('/')) return '/'
  try {
    const url = new URL(next, BASE)
    return url.origin === BASE ? url.pathname + url.search + url.hash : '/'
  } catch {
    return '/'
  }
}
