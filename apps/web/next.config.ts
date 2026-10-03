import type { NextConfig } from 'next'

const config: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@exam/bank', '@exam/core', '@exam/extraction', '@exam/figures', '@exam/grading', '@exam/importer', '@exam/ink', '@exam/ingest', '@exam/models', '@exam/quiz', '@exam/settings', '@exam/sharing', '@exam/usage'],
  // Native or Node-only libraries stay outside the bundle.
  serverExternalPackages: ['sharp', 'pdfjs-dist', '@napi-rs/canvas'],
  experimental: { serverActions: { bodySizeLimit: '50mb' } },
  agentRules: false,
  // The dev badge sits over the sidebar and the review page's action button.
  devIndicators: false,
}

export default config
