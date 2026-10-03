import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { repoRoot } from './env'
import { PostgresBank, SqliteBank, type Bank } from '@exam/bank'
import { connect } from '@exam/db'
import { DEFAULT_MODELS, MODEL_CATALOG, type ModelTier } from '@exam/extraction'
import { fileStoreFromEnv, type FileStore } from '@exam/files'
import { Importer } from '@exam/importer'
import { AiTeacher, createTextModel, PostgresGradingCache, SqliteGradingCache, type GradingCache, type TextModel } from '@exam/grading'
import { PostgresQuizStore, SqliteQuizStore, type QuizStore } from '@exam/quiz'
import { DEFAULT_LOCALE, FileSettingsStore, PostgresSettingsStore, type SettingsStore } from '@exam/settings'
import { authEnabled } from './auth'

export { currentOwner, currentUser, authEnabled } from './auth'

/**
 * The one place the web app wires its modules together. Each part is picked from the
 * environment on its own (see docs/HOSTING.md):
 *   DATABASE_URL                  Postgres (Supabase) instead of data/bank.sqlite
 *   R2_*                          Cloudflare R2 instead of the data folder for files
 *   NEXT_PUBLIC_SUPABASE_*        Google sign-in instead of one local user
 */

export const dataDir = resolve(process.env.EXAM_DATA_DIR ?? join(repoRoot, 'data'))

interface Services {
  bank: Bank
  importer: Importer
  quizzes: QuizStore
  settings: SettingsStore
  gradingCache: GradingCache
  files: FileStore
}

// Kept on globalThis so hot reloads in development reuse one database connection
// and background extraction runs keep going.
const globals = globalThis as typeof globalThis & { __examServices?: Services }

export function services(): Services {
  if (!globals.__examServices) {
    mkdirSync(dataDir, { recursive: true })
    const stores = process.env.DATABASE_URL ? postgresStores(process.env.DATABASE_URL) : sqliteStores()
    const files = fileStoreFromEnv(dataDir)
    globals.__examServices = {
      ...stores,
      files,
      importer: new Importer({
        bank: stores.bank,
        files,
        // With accounts, every file key starts with its owner, so a link can be checked against the person asking.
        keyPrefix: authEnabled() ? (ownerId) => `u/${ownerId}/` : undefined,
        reviewLanguage: localeOf,
        providerConfig: async (providerId, ownerId) => {
          const s = await stores.settings.get(ownerId)
          return { apiKey: s.apiKeys[providerId] || undefined, model: s.models[providerId] || undefined }
        },
      }),
    }
  }
  return globals.__examServices
}

type Stores = Pick<Services, 'bank' | 'quizzes' | 'settings' | 'gradingCache'>

function sqliteStores(): Stores {
  const dbFile = join(dataDir, 'bank.sqlite')
  return {
    bank: new SqliteBank(dbFile),
    quizzes: new SqliteQuizStore(dbFile),
    settings: new FileSettingsStore(join(dataDir, 'settings.json')),
    gradingCache: new SqliteGradingCache(dbFile),
  }
}

function postgresStores(url: string): Stores {
  const secret = process.env.SETTINGS_SECRET
  if (!secret) throw new Error('SETTINGS_SECRET is required with DATABASE_URL: it encrypts the API keys people save.')
  const sql = connect(url)
  return { bank: new PostgresBank(sql), quizzes: new PostgresQuizStore(sql), settings: new PostgresSettingsStore(sql, secret), gradingCache: new PostgresGradingCache(sql) }
}

/**
 * Interface language of a user, as a language tag: their choice on the settings page,
 * else EXAM_LOCALE, else zh-Hant. The model writes its review notes (⚠ issues) in this language.
 */
export async function localeOf(ownerId: string): Promise<string> {
  return (await services().settings.get(ownerId)).locale ?? (process.env.EXAM_LOCALE || DEFAULT_LOCALE)
}

/** Environment variables each provider's SDK reads its API key from. */
export const ENV_KEYS: Record<string, string[]> = {
  claude: ['ANTHROPIC_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
}

/** Where a provider's API key comes from for this user: the settings page, the .env file, or nowhere. */
export async function keySource(ownerId: string, providerId: string): Promise<'settings' | 'env' | null> {
  if ((await services().settings.get(ownerId)).apiKeys[providerId]) return 'settings'
  return envKey(providerId) ? 'env' : null
}

/** The key to call a provider with: the user's own first, then the .env file. */
export async function apiKeyOf(ownerId: string, providerId: string): Promise<string | undefined> {
  return (await services().settings.get(ownerId)).apiKeys[providerId] || envKey(providerId)
}

/**
 * A key from the server's .env. Only for the single local user: with accounts, everyone
 * brings their own key, so the server's key is never spent on someone else's requests.
 */
function envKey(providerId: string): string | undefined {
  if (authEnabled()) return undefined
  return ENV_KEYS[providerId]?.map((name) => process.env[name]).find(Boolean)
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
export async function availableProviders(ownerId: string): Promise<ProviderOption[]> {
  const s = await services().settings.get(ownerId)
  const api = (id: string, label: string): ProviderOption => {
    const catalog = MODEL_CATALOG[id] ?? []
    const known = (s.knownModels[id] ?? []).filter((m) => !catalog.some((c) => c.id === m)).map((m) => ({ id: m, label: m, tier: null }))
    return { id, label, ready: Boolean(s.apiKeys[id] || envKey(id)), models: [...catalog, ...known], model: s.models[id] || process.env[`${id.toUpperCase()}_MODEL`] || DEFAULT_MODELS[id] || '' }
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
export type Teacher = { teacher: AiTeacher; reader: TextModel; provider: string; model: string }

/** The provider and model AI marking would use, whether or not it is switched on (null: no key yet). */
export async function teacherChoice(ownerId: string): Promise<{ provider: string; model: string } | null> {
  const s = await services().settings.get(ownerId)
  const { aiGrading } = s
  const keyOf = (id: string) => s.apiKeys[id] || envKey(id)
  const provider = aiGrading.provider && keyOf(aiGrading.provider) ? aiGrading.provider : API_PROVIDERS.find((id) => keyOf(id))
  if (!provider) return null
  const model = (aiGrading.provider === provider && aiGrading.model) || MODEL_CATALOG[provider]?.find((m) => m.tier === 'fast')?.id || DEFAULT_MODELS[provider]!
  return { provider, model }
}

export async function teacherFor(ownerId: string): Promise<Teacher | null> {
  const s = await services().settings.get(ownerId)
  if (!s.aiGrading.enabled) return null
  const choice = await teacherChoice(ownerId)
  if (!choice) return null
  const { provider, model } = choice
  const keyOf = (id: string) => s.apiKeys[id] || envKey(id)
  // The same model also reads handwritten answers (all catalogued models take images).
  const reader = createTextModel(provider, { apiKey: keyOf(provider)!, model })
  return { teacher: new AiTeacher(reader), reader, provider, model }
}
