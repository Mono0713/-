import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** The repo root; `next dev` runs in apps/web. */
export const repoRoot = resolve(process.cwd(), '../..')

// API keys and hosting settings live in the repo-root .env shared with the CLI.
// Imported first by every server module that reads the environment.
const envFile = join(repoRoot, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)
