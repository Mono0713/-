import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { SqliteBank, type Bank } from '@exam/bank'
import { Importer } from '@exam/importer'

/**
 * The one place the web app wires its modules together. Swapping the database,
 * file storage or sign-in later means changing this file, not the features.
 */

// `next dev` runs in apps/web; API keys live in the repo-root .env shared with the CLI.
const repoRoot = resolve(process.cwd(), '../..')
const envFile = join(repoRoot, '.env')
if (existsSync(envFile)) process.loadEnvFile(envFile)

export const dataDir = resolve(process.env.EXAM_DATA_DIR ?? join(repoRoot, 'data'))

interface Services {
  bank: Bank
  importer: Importer
}

// Kept on globalThis so hot reloads in development reuse one database connection
// and background extraction runs keep going.
const globals = globalThis as typeof globalThis & { __examServices?: Services }

export function services(): Services {
  if (!globals.__examServices) {
    mkdirSync(dataDir, { recursive: true })
    const bank = new SqliteBank(join(dataDir, 'bank.sqlite'))
    globals.__examServices = { bank, importer: new Importer({ bank, dataDir }) }
  }
  return globals.__examServices
}

/** Everyone is the same local user until sign-in is added. */
export function currentOwner(): string {
  return 'local'
}

/** Which model providers have an API key configured. */
export function availableProviders(): { id: string; label: string; ready: boolean }[] {
  return [
    { id: 'manual', label: '手動（貼上聊天 App 的回覆）', ready: true },
    { id: 'claude', label: 'Claude API', ready: Boolean(process.env.ANTHROPIC_API_KEY) },
    { id: 'gemini', label: 'Gemini API', ready: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) },
    { id: 'openai', label: 'OpenAI API', ready: Boolean(process.env.OPENAI_API_KEY) },
  ]
}
