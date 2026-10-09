import type { NextConfig } from 'next'

/**
 * Sent with every page. They stop other sites from framing the app (clickjacking), browsers from
 * guessing file types, and full addresses from leaking to other sites; the camera is only for
 * scanning on this site. HSTS keeps browsers on https once the site is hosted (ignored on localhost).
 */
/**
 * Where pictures may load from: this site, ones made in the page, R2's short-lived file links, and Google
 * profile photos. A picture link typed into a question (Markdown) to any other site is not loaded, so a shared
 * exam cannot tell a stranger's server who opened it.
 */
function imageSources(): string {
  const sources = ["'self'", 'data:', 'blob:', 'https://*.r2.cloudflarestorage.com', 'https://*.googleusercontent.com']
  try {
    // a file store other than R2 (any S3-compatible endpoint): its links too
    if (process.env.R2_ENDPOINT) sources.push(new URL(process.env.R2_ENDPOINT).origin, `https://*.${new URL(process.env.R2_ENDPOINT).host}`)
  } catch {
    // not a URL: the store will not work either
  }
  return [...new Set(sources)].join(' ')
}

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: `frame-ancestors 'none'; object-src 'none'; base-uri 'self'; img-src ${imageSources()}` },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const config: NextConfig = {
  poweredByHeader: false,
  headers: async () => [{ source: '/:path*', headers: SECURITY_HEADERS }],
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@exam/bank', '@exam/classes', '@exam/core', '@exam/extraction', '@exam/figures', '@exam/grading', '@exam/importer', '@exam/ink', '@exam/ingest', '@exam/models', '@exam/quiz', '@exam/settings', '@exam/sharing', '@exam/usage'],
  // Native or Node-only libraries stay outside the bundle.
  serverExternalPackages: ['sharp', 'pdfjs-dist', '@napi-rs/canvas'],
  experimental: { serverActions: { bodySizeLimit: '50mb' } },
  agentRules: false,
  // The dev badge sits over the sidebar and the review page's action button.
  devIndicators: false,
}

export default config
