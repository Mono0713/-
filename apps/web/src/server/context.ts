import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { SqliteBank, type Bank } from '@exam/bank'
import { DEFAULT_MODELS, MODEL_CATALOG, type ModelTier } from '@exam/extraction'
import { Importer } from '@exam/importer'
import { AiTeacher, createTextModel, SqliteGradingCache, type GradingCache } from '@exam/grading'
import { SqliteQuizStore, type QuizStore } from '@exam/quiz'
import { DEFAULT_LOCALE, FileSettingsStore, type SettingsStore } from '@exam/settings'

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
  quizzes: QuizStore
  settings: SettingsStore
  gradingCache: GradingCache
}

// Kept on globalThis so hot reloads in development reuse one database connection
// and background extraction runs keep going.
const globals = globalThis as typeof globalThis & { __examServices?: Services }

export function services(): Services {
  if (!globals.__examServices) {
    mkdirSync(dataDir, { recursive: true })
    const dbFile = join(dataDir, 'bank.sqlite')
    const bank = new SqliteBank(dbFile)
    const settings = new FileSettingsStore(join(dataDir, 'settings.json'))
    globals.__examServices = {
      bank,
      importer: new Importer({
        bank,
        dataDir,
        reviewLanguage: localeOf,
        providerConfig: (providerId, ownerId) => {
          const s = settings.get(ownerId)
          return { apiKey: s.apiKeys[providerId] || undefined, model: s.models[providerId] || undefined }
        },
      }),
      quizzes: new SqliteQuizStore(dbFile),
      settings,
      gradingCache: new SqliteGradingCache(dbFile),
    }
  }
  return globals.__examServices
}

/** Everyone is the same local user until sign-in is added. */
export function currentOwner(): string {
  return 'local'
}

/**
 * Interface language of a user, as a language tag: their choice on the settings page,
 * else EXAM_LOCALE, else zh-Hant. The model writes its review notes (⚠ issues) in this language.
 */
export function localeOf(ownerId: string): string {
  return services().settings.get(ownerId).locale ?? (process.env.EXAM_LOCALE || DEFAULT_LOCALE)
}

/** Environment variables each provider's SDK reads its API key from. */
export const ENV_KEYS: Record<string, string[]> = {
  claude: ['ANTHROPIC_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
}

/** Where a provider's API key comes from for this user: the settings page, the .env file, or nowhere. */
export function keySource(ownerId: string, providerId: string): 'settings' | 'env' | null {
  if (services().settings.get(ownerId).apiKeys[providerId]) return 'settings'
  return ENV_KEYS[providerId]?.some((name) => process.env[name]) ? 'env' : null
}

/** The key to call a provider with: the user's own first, then the .env file. */
export function apiKeyOf(ownerId: string, providerId: string): string | undefined {
  return services().settings.get(ownerId).apiKeys[providerId] || ENV_KEYS[providerId]?.map((name) => process.env[name]).find(Boolean)
}

export interface ProviderOption {
  id: string
  label: string
  ready: boolean
  /** Models to offer, and the one to preselect. */
  models: { id: string; label: string; tier: ModelTier | null }[]
  model: string
}

// Manual mode records which chat app read the pages, for reference only.
const CHAT_APPS = ['Claude', 'ChatGPT', 'Gemini'].map((id) => ({ id, label: id, tier: null }))

/** Recognition methods for this user: whether each has an API key, and its models. */
export function availableProviders(ownerId: string = currentOwner()): ProviderOption[] {
  const s = services().settings.get(ownerId)
  const api = (id: string, label: string): ProviderOption => {
    const catalog = MODEL_CATALOG[id] ?? []
    const known = (s.knownModels[id] ?? []).filter((m) => !catalog.some((c) => c.id === m)).map((m) => ({ id: m, label: m, tier: null }))
    return { id, label, ready: keySource(ownerId, id) !== null, models: [...catalog, ...known], model: s.models[id] || process.env[`${id.toUpperCase()}_MODEL`] || DEFAULT_MODELS[id] || '' }
  }
  return [
    { id: 'manual', label: '手動（貼上聊天 App 的回覆）', ready: true, models: CHAT_APPS, model: s.models.manual ?? '' },
    api('claude', 'Claude API'),
    api('gemini', 'Gemini API'),
    api('openai', 'OpenAI API'),
  ]
}

const API_PROVIDERS = ['claude', 'openai', 'gemini']

/**
 * The AI teacher for this user, or null when AI marking is off or no API key is set.
 * Unless the user picked one, it uses the first provider with a key and its cheapest model:
 * marking answers needs far less than reading a scanned page.
 */
export function teacherFor(ownerId: string): { teacher: AiTeacher; provider: string; model: string } | null {
  const { aiGrading } = services().settings.get(ownerId)
  if (!aiGrading.enabled) return null
  const provider = aiGrading.provider && apiKeyOf(ownerId, aiGrading.provider) ? aiGrading.provider : API_PROVIDERS.find((id) => apiKeyOf(ownerId, id))
  if (!provider) return null
  const model = (aiGrading.provider === provider && aiGrading.model) || MODEL_CATALOG[provider]?.find((m) => m.tier === 'fast')?.id || DEFAULT_MODELS[provider]!
  return { teacher: new AiTeacher(createTextModel(provider, { apiKey: apiKeyOf(ownerId, provider)!, model })), provider, model }
}
