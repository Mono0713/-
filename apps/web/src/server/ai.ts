import { DEFAULT_MODELS, type ModelTier } from '@exam/extraction'
import { AUTO } from '@exam/importer'
import { AiSolver, AiTeacher, AiTranslator, FreeTranslator, AiTutor, createTextModel, type TextModel } from '@exam/grading'
import { BUILTIN_LABELS, BUILTIN_MODELS, route, type ModelChoice, type ProviderInfo, type Route, type Strength, type Task } from '@exam/models'
import type { Settings } from '@exam/settings'
import { authEnabled } from './auth'
import { services } from './context'
import { checkServiceUrl } from './serviceUrl'
import { fill, type T } from '@/shared/i18n/format'

// Which AI service and model each task uses for a user, their API keys, and the AI helpers
// (teacher, tutor, translator) built on those choices. Every call is logged for the usage summary.

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
export async function serviceUrlOf(s: Settings, providerId: string): Promise<string | undefined> {
  const custom = s.customProviders.find((c) => c.id === providerId)
  if (!custom) return undefined
  // Outside a request (no cookies to read the language from) errors stay in Traditional Chinese.
  const { getT } = await import('@/shared/i18n/server')
  const t = await getT().catch(() => fill)
  return checkServiceUrl(custom.baseUrl, authEnabled(), t)
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
  const { getT } = await import('@/shared/i18n/server')
  const t = await getT()
  const s = await services().settings.get(ownerId)
  const providers = providersOf(s)
  const plan = route('recognition', strengthOf(s, 'recognition'), providers, { override: overrideOf(s, 'recognition') })
  const name = (c: ModelChoice) => providers.find((p) => p.id === c.provider)?.models.find((m) => m.id === c.model)?.label ?? c.model
  const auto: ProviderOption = {
    id: AUTO,
    label: t('自動（依 AI 強度）'),
    ready: plan !== null,
    models: [],
    model: '',
    note: plan ? planNote(t, name(plan.primary), plan.escalate && name(plan.escalate), plan.fallbacks.map(name).join(t('、'))) : undefined,
  }
  const options = providers.map((p): ProviderOption => {
    const custom = !BUILTIN.includes(p.id)
    const catalog = p.models.map(({ id, label, tier }) => ({ id, label, tier }))
    const known = (s.knownModels[p.id] ?? []).filter((m) => !catalog.some((c) => c.id === m)).map((m) => ({ id: m, label: m, tier: null }))
    const fallback = custom ? (p.models[0]?.id ?? '') : process.env[`${p.id.toUpperCase()}_MODEL`] || DEFAULT_MODELS[p.id] || ''
    return { id: p.id, label: custom ? p.label : `${p.label} API`, ready: p.ready, models: [...catalog, ...known], model: s.models[p.id] || fallback }
  })
  return [auto, { id: 'manual', label: t('手動（貼上聊天 App 的回覆）'), ready: true, models: CHAT_APPS, model: s.models.manual ?? '' }, ...options]
}

/** What automatic recognition does: the model it uses, the one it double-checks with, and the ones it falls back to. */
function planNote(t: T, primary: string, escalate: string | null | undefined, fallbacks: string): string {
  if (escalate && fallbacks) return t('用 {primary}，沒把握的頁再用 {escalate} 讀一次；讀不了時換 {fallbacks}', { primary, escalate, fallbacks })
  if (escalate) return t('用 {primary}，沒把握的頁再用 {escalate} 讀一次', { primary, escalate })
  if (fallbacks) return t('用 {primary}；讀不了時換 {fallbacks}', { primary, fallbacks })
  return t('用 {primary}', { primary })
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

/** Works out answers for questions printed without a key, on the user's own keys and the tutor's route (it explains as a tutor does); null without a key. */
export async function solverFor(ownerId: string): Promise<AiSolver | null> {
  const s = await services().settings.get(ownerId)
  const tutoring = await routeFor(ownerId, 'tutoring')
  if (!tutoring) return null
  return new AiSolver(await chain(s, ownerId, 'tutoring', [tutoring.primary, ...tutoring.fallbacks]))
}

/**
 * Translates questions for this user: free services by default, or the AI on their own keys and
 * the translation route when they chose AI translation (free again while no service has a key).
 */
export async function translatorFor(ownerId: string): Promise<{ engine: 'free' | 'ai'; translator: Pick<AiTranslator, 'translate'> }> {
  const s = await services().settings.get(ownerId)
  const translation = s.translationEngine === 'ai' ? await routeFor(ownerId, 'translation') : null
  if (!translation) return { engine: 'free', translator: new FreeTranslator() }
  return { engine: 'ai', translator: new AiTranslator(await chain(s, ownerId, 'translation', [translation.primary, ...translation.fallbacks])) }
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
