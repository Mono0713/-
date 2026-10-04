import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { repoRoot } from './env'
import { PostgresBank, SqliteBank, type Bank } from '@exam/bank'
import { PostgresClassStore, SqliteClassStore, type ClassStore } from '@exam/classes'
import { connect } from '@exam/db'
import { DEFAULT_MODELS, type ModelTier } from '@exam/extraction'
import { DedupFileStore, fileStoreFromEnv, PostgresFileIndex, SqliteFileIndex, type FileIndex } from '@exam/files'
import { AUTO, Importer } from '@exam/importer'
import { AiTeacher, AiTranslator, AiTutor, createTextModel, PostgresGradingCache, SqliteGradingCache, type GradingCache, type TextModel } from '@exam/grading'
import { BUILTIN_LABELS, BUILTIN_MODELS, route, type ModelChoice, type ProviderInfo, type Route, type Strength, type Task } from '@exam/models'
import { PostgresQuizStore, SqliteQuizStore, type QuizStore } from '@exam/quiz'
import { DEFAULT_LOCALE, FileSettingsStore, PostgresSettingsStore, type Settings, type SettingsStore } from '@exam/settings'
import { PostgresShareStore, SqliteShareStore, type ShareStore } from '@exam/sharing'
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
  shares: ShareStore
  classes: ClassStore
  /** Each distinct file is kept once, whatever key it is written under. */
  files: DedupFileStore
}

// Kept on globalThis so hot reloads in development reuse one database connection
// and background extraction runs keep going.
const globals = globalThis as typeof globalThis & { __examServices?: Services }

export function services(): Services {
  if (!globals.__examServices) {
    mkdirSync(dataDir, { recursive: true })
    const stores = process.env.DATABASE_URL ? postgresStores(process.env.DATABASE_URL) : sqliteStores()
    const { fileIndex, ...rest } = stores
    const files = new DedupFileStore(fileStoreFromEnv(dataDir), fileIndex)
    globals.__examServices = {
      ...rest,
      files,
      importer: new Importer({
        bank: stores.bank,
        files,
        // With accounts, every file key starts with its owner, so a link can be checked against the person asking.
        keyPrefix: authEnabled() ? keyPrefixOf : undefined,
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
    const { importer } = globals.__examServices
    void importer.recoverInterrupted().catch((err) => console.error('Marking interrupted imports failed:', err))
    sweepOriginals(importer)
  }
  return globals.__examServices
}

// How often uploaded files past their 30 days are looked for.
const SWEEP_EVERY = 6 * 3_600_000

/** Deletes expired uploaded files now and then while the server runs. */
function sweepOriginals(importer: Importer) {
  const sweep = () => void importer.expireOriginals().catch((err) => console.error('Deleting expired uploads failed:', err))
  setTimeout(sweep, 10_000).unref()
  setInterval(sweep, SWEEP_EVERY).unref()
}

/**
 * Most an account may keep, in bytes: STORAGE_QUOTA_MB (1 GB by default). Only with accounts;
 * the single local user keeps what fits on the computer.
 */
export function storageQuota(): number | null {
  if (!authEnabled()) return null
  return (Number(process.env.STORAGE_QUOTA_MB) || 1024) * 1024 * 1024
}

/** What an account keeps, and how much it may. */
export async function storageOf(ownerId: string): Promise<{ used: number; quota: number | null }> {
  // Without accounts, file keys carry no owner.
  return { used: await services().files.usage(authEnabled() ? ownerId : null), quota: storageQuota() }
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)

/** Why `bytes` more would not fit in the account, or null when it fits. */
export async function noRoomFor(ownerId: string, bytes: number): Promise<string | null> {
  const { used, quota } = await storageOf(ownerId)
  if (quota === null || used + bytes <= quota) return null
  return `空間不夠：已用 ${mb(used)} MB，上限 ${mb(quota)} MB。可以刪掉用不到的匯入或考卷，或取消「永久保留原檔」，再試一次。`
}

/** Start of every file key of an owner when there are accounts, so a file link can be checked against the person asking. */
export function keyPrefixOf(ownerId: string): string {
  return authEnabled() ? `u/${ownerId}/` : ''
}

type Stores = Pick<Services, 'bank' | 'quizzes' | 'settings' | 'gradingCache' | 'usage' | 'shares' | 'classes'> & { fileIndex: FileIndex }

function sqliteStores(): Stores {
  const dbFile = join(dataDir, 'bank.sqlite')
  return {
    bank: new SqliteBank(dbFile),
    quizzes: new SqliteQuizStore(dbFile),
    settings: new FileSettingsStore(join(dataDir, 'settings.json')),
    gradingCache: new SqliteGradingCache(dbFile),
    usage: new SqliteUsageStore(dbFile),
    shares: new SqliteShareStore(dbFile),
    classes: new SqliteClassStore(dbFile),
    fileIndex: new SqliteFileIndex(dbFile),
  }
}

function postgresStores(url: string): Stores {
  const secret = process.env.SETTINGS_SECRET
  if (!secret) throw new Error('SETTINGS_SECRET is required with DATABASE_URL: it encrypts the API keys people save.')
  const sql = connect(url)
  return { bank: new PostgresBank(sql), quizzes: new PostgresQuizStore(sql), settings: new PostgresSettingsStore(sql, secret), gradingCache: new PostgresGradingCache(sql), usage: new PostgresUsageStore(sql), shares: new PostgresShareStore(sql), classes: new PostgresClassStore(sql), fileIndex: new PostgresFileIndex(sql) }
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
 * For a class the teacher pays for, `scope` tags the calls (for its monthly cap) and
 * `always` uses the teacher's keys even when their own AI marking is switched off.
 */
export async function teacherFor(ownerId: string, opts: { scope?: string; always?: boolean } = {}): Promise<Teacher | null> {
  const s = await services().settings.get(ownerId)
  if (!s.aiGrading.enabled && !opts.always) return null
  const grading = await routeFor(ownerId, 'grading')
  if (!grading) return null
  const handwriting = (await routeFor(ownerId, 'handwriting')) ?? grading
  const marker = await chain(s, ownerId, 'grading', [grading.primary, ...grading.fallbacks], opts.scope)
  const reader = await chain(s, ownerId, 'handwriting', [handwriting.primary, ...handwriting.fallbacks], opts.scope)
  return { teacher: new AiTeacher(marker), reader, provider: grading.primary.provider, model: grading.primary.model }
}

/** The AI tutor for this user, on their own keys and the tutoring route; null when no service has a key. */
export async function tutorFor(ownerId: string): Promise<AiTutor | null> {
  const s = await services().settings.get(ownerId)
  const tutoring = await routeFor(ownerId, 'tutoring')
  if (!tutoring) return null
  return new AiTutor(await chain(s, ownerId, 'tutoring', [tutoring.primary, ...tutoring.fallbacks]))
}

/** Translates questions for this user, on their own keys and the translation route; null when no service has a key. */
export async function translatorFor(ownerId: string): Promise<AiTranslator | null> {
  const s = await services().settings.get(ownerId)
  const translation = await routeFor(ownerId, 'translation')
  if (!translation) return null
  return new AiTranslator(await chain(s, ownerId, 'translation', [translation.primary, ...translation.fallbacks]))
}

/** A text model that moves on to the next choice when one fails, logging what each call used. */
async function chain(s: Settings, ownerId: string, task: Task, choices: ModelChoice[], scope?: string): Promise<TextModel> {
  // A service whose address no longer passes the check is left out; the others still work.
  const settled = await Promise.allSettled(
    choices.map(async ({ provider, model }) =>
      createTextModel(provider, {
        apiKey: s.apiKeys[provider] || envKey(provider) || '',
        model,
        baseUrl: await serviceUrlOf(s, provider),
        onUsage: (u) => void services().usage.record({ ownerId, task, provider, model, ...u, ...(scope && { scope }) }).catch(() => {}),
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
