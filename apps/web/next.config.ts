import type { NextConfig } from 'next'

const config: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ['@exam/bank', '@exam/core', '@exam/extraction', '@exam/figures', '@exam/importer', '@exam/ingest', '@exam/quiz'],
  // Native or Node-only libraries stay outside the bundle.
  serverExternalPackages: ['sharp', 'pdfjs-dist', '@napi-rs/canvas'],
  experimental: { serverActions: { bodySizeLimit: '50mb' } },
  agentRules: false,
}

export default config
