import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { repoRoot } from './env'
import { PostgresBank, SqliteBank, type Bank } from '@exam/bank'
import { connect } from '@exam/db'
import { DEFAULT_MODELS, type ModelTier } from '@exam/extraction'
import { fileStoreFromEnv, type FileStore } from '@exam/files'
import { AUTO, Importer } from '@exam/importer'
import { AiTeacher, createTextModel, PostgresGradingCache, SqliteGradingCache, type GradingCache, type TextModel } from '@exam/grading'
import { BUILTIN_LABELS, BUILTIN_MODELS, route, type ModelChoice, type ProviderInfo, type Route, type Strength, type Task } from '@exam/models'
import { PostgresQuizStore, SqliteQuizStore, type QuizStore } from '@exam/quiz'
import { DEFAULT_LOCALE, FileSettingsStore, PostgresSettingsStore, type Settings, type SettingsStore } from '@exam/settings'
import { PostgresUsageStore, SqliteUsageStore, type UsageStore } from '@exam/usage'
import { authEnabled } from './auth'
import { checkServiceUrl } from './serviceUrl'

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
  usage: UsageStore
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
          const custom = s.customProviders.find((c) => c.id === providerId)
          return { apiKey: s.apiKeys[providerId] || undefined, model: s.models[providerId] || custom?.models[0]?.id, baseUrl: await serviceUrlOf(s, providerId) }
        },
        plan: async (ownerId) => {
          const r = await routeFor(ownerId, 'recognition')
          return r && { primary: r.primary, fallbacks: r.fallbacks, escalate: r.escalate }
        },
        onPage: (imp, r) =>
          void stores.usage.record({ ownerId: imp.ownerId, task: 'recognition', provider: r.provider, model: r.model, inputTokens: r.usage.inputTokens, outputTokens: r.usage.outputTokens }).catch(() => {}),
      }),
    }
  }
  return globals.__examServices
}

type Stores = Pick<Services, 'bank' | 'quizzes' | 'settings' | 'gradingCache' | 'usage'>

function sqliteStores(): Stores {
  const dbFile = join(dataDir, 'bank.sqlite')
  return {
    bank: new SqliteBank(dbFile),
    quizzes: new SqliteQuizStore(dbFile),
    settings: new FileSettingsStore(join(dataDir, 'settings.json')),
    gradingCache: new SqliteGradingCache(dbFile),
    usage: new SqliteUsageStore(dbFile),
  }
}

function postgresStores(url: string): Stores {
  const secret = process.env.SETTINGS_SECRET
  if (!secret) throw new Error('SETTINGS_SECRET is required with DATABASE_URL: it encrypts the API keys people save.')
  const sql = connect(url)
  return { bank: new PostgresBank(sql), quizzes: new PostgresQuizStore(sql), settings: new PostgresSettingsStore(sql, secret), gradingCache: new PostgresGradingCache(sql), usage: new PostgresUsageStore(sql) }
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

const BUILTIN = ['claude', 'openai', 'gemini']

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

/**
 * Every service this user can route to: Claude, OpenAI and Gemini with their catalogued
 * models, then the services they added. A local service such as Ollama needs no key.
 */
export function providersOf(s: Settings): ProviderInfo[] {
  return [
    ...BUILTIN.map((id) => ({ id, label: BUILTIN_LABELS[id]!, ready: Boolean(s.apiKeys[id] || envKey(id)), models: BUILTIN_MODELS[id]! })),
    ...s.customProviders.map((c) => ({
      id: c.id,
      label: c.name,
      ready: true,
      models: c.models.map((m) => ({ id: m.id, label: m.id, tier: m.tier, vision: m.vision, price: m.price })),
    })),
  ]
}

/**
 * The address of a service the person added, checked again before every use: hosted, a
 * name that now points inside the network is refused. Undefined for the built-in providers.
 */
async function serviceUrlOf(s: Settings, providerId: string): Promise<string | undefined> {
  const custom = s.customProviders.find((c) => c.id === providerId)
  return custom ? checkServiceUrl(custom.baseUrl, authEnabled()) : undefined
}

/** The strength a task runs at for this user: its own, or the overall one. */
export const strengthOf = (s: Settings, task: Task): Strength => s.taskStrength[task] ?? s.strength

/** A model picked by hand for a task, if any; AI marking's older setting still counts. */
function overrideOf(s: Settings, task: Task): ModelChoice | null {
  const picked = s.taskModels[task]
  if (picked) return picked
  if (task === 'grading' && s.aiGrading.provider) {
    const model = s.aiGrading.model || route('grading', s.strength, providersOf(s).filter((p) => p.id === s.aiGrading.provider))?.primary.model
    return model ? { provider: s.aiGrading.provider, model } : null
  }
  return null
}

/** The models a task uses for this user right now; null when no service with a key can do it. */
export async function routeFor(ownerId: string, task: Task): Promise<Route | null> {
  const s = await services().settings.get(ownerId)
  return route(task, strengthOf(s, task), providersOf(s), { override: overrideOf(s, task) })
}

export interface ProviderOption {
  id: string
  label: string
  ready: boolean
  /** Models to offer, and the one to preselect. */
  models: { id: string; label: string; tier: ModelTier | null }[]
  model: string
  /** What the option does, for one that picks its models itself. */
  note?: string
}

// Manual mode records which chat app read the pages, for reference only.
const CHAT_APPS = ['Claude', 'ChatGPT', 'Gemini'].map((id) => ({ id, label: id, tier: null }))

/** Recognition methods for this user: automatic, manual, then every service, with its models and whether it has a key. */
export async function availableProviders(ownerId: string): Promise<ProviderOption[]> {
  const s = await services().settings.get(ownerId)
  const providers = providersOf(s)
  const plan = route('recognition', strengthOf(s, 'recognition'), providers, { override: overrideOf(s, 'recognition') })
  const name = (c: ModelChoice) => providers.find((p) => p.id === c.provider)?.models.find((m) => m.id === c.model)?.label ?? c.model
  const auto: ProviderOption = {
    id: AUTO,
    label: '自動（依 AI 強度）',
    ready: plan !== null,
    models: [],
    model: '',
    note: plan ? `用 ${name(plan.primary)}${plan.escalate ? `，沒把握的頁再用 ${name(plan.escalate)} 讀一次` : ''}${plan.fallbacks.length ? `；讀不了時換 ${plan.fallbacks.map(name).join('、')}` : ''}` : undefined,
  }
  const options = providers.map((p): ProviderOption => {
    const custom = !BUILTIN.includes(p.id)
    const catalog = p.models.map(({ id, label, tier }) => ({ id, label, tier }))
    const known = (s.knownModels[p.id] ?? []).filter((m) => !catalog.some((c) => c.id === m)).map((m) => ({ id: m, label: m, tier: null }))
    const fallback = custom ? (p.models[0]?.id ?? '') : process.env[`${p.id.toUpperCase()}_MODEL`] || DEFAULT_MODELS[p.id] || ''
    return { id: p.id, label: custom ? p.label : `${p.label} API`, ready: p.ready, models: [...catalog, ...known], model: s.models[p.id] || fallback }
  })
  return [auto, { id: 'manual', label: '手動（貼上聊天 App 的回覆）', ready: true, models: CHAT_APPS, model: s.models.manual ?? '' }, ...options]
}

export type Teacher = { teacher: AiTeacher; reader: TextModel; provider: string; model: string }

/** The provider and model AI marking would use, whether or not it is switched on (null: no key yet). */
export async function teacherChoice(ownerId: string): Promise<ModelChoice | null> {
  return (await routeFor(ownerId, 'grading'))?.primary ?? null
}

/**
 * The AI teacher for this user, or null when AI marking is off or no service has a key.
 * Marking and reading handwriting each follow their own route, fallbacks included,
 * and every call is logged for the usage summary.
 */
export async function teacherFor(ownerId: string): Promise<Teacher | null> {
  const s = await services().settings.get(ownerId)
  if (!s.aiGrading.enabled) return null
  const grading = await routeFor(ownerId, 'grading')
  if (!grading) return null
  const handwriting = (await routeFor(ownerId, 'handwriting')) ?? grading
  const marker = await chain(s, ownerId, 'grading', [grading.primary, ...grading.fallbacks])
  const reader = await chain(s, ownerId, 'handwriting', [handwriting.primary, ...handwriting.fallbacks])
  return { teacher: new AiTeacher(marker), reader, provider: grading.primary.provider, model: grading.primary.model }
}

/** A text model that moves on to the next choice when one fails, logging what each call used. */
async function chain(s: Settings, ownerId: string, task: Task, choices: ModelChoice[]): Promise<TextModel> {
  // A service whose address no longer passes the check is left out; the others still work.
  const settled = await Promise.allSettled(
    choices.map(async ({ provider, model }) =>
      createTextModel(provider, {
        apiKey: s.apiKeys[provider] || envKey(provider) || '',
        model,
        baseUrl: await serviceUrlOf(s, provider),
        onUsage: (u) => void services().usage.record({ ownerId, task, provider, model, ...u }).catch(() => {}),
      }),
    ),
  )
  const models = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
  if (!models.length) throw (settled[0] as PromiseRejectedResult).reason
  const first = models[0]!
  return {
    provider: first.provider,
    model: first.model,
    async complete(system, prompt, images) {
      let error: unknown
      for (const m of models) {
        try {
          return await m.complete(system, prompt, images)
        } catch (err) {
          error = err
        }
      }
      throw error
    },
  }
}
