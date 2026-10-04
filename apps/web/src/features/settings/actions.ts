'use server'

import { randomBytes } from 'node:crypto'
import { listModels } from '@exam/extraction'
import type { Strength, Task, Tier } from '@exam/models'
import type { CustomProvider } from '@exam/settings'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { apiKeyOf, authEnabled, currentOwner, services } from '@/server/context'
import { checkServiceUrl } from '@/server/serviceUrl'
import { isLocale, LOCALE_COOKIE } from '@/shared/i18n/locales'
import { getT } from '@/shared/i18n/server'
import { NAME_MAX } from './profile'

type Result = { ok: true; note?: string } | { ok: false; error: string }

const API_PROVIDERS = ['claude', 'openai', 'gemini']
const STRENGTHS: Strength[] = ['save', 'balanced', 'best']
const TASKS: Task[] = ['recognition', 'handwriting', 'grading', 'tutoring', 'translation']

async function save(patch: Parameters<ReturnType<typeof services>['settings']['update']>[1]) {
  await services().settings.update(await currentOwner(), patch)
  revalidatePath('/', 'layout')
}

const mine = async () => services().settings.get(await currentOwner())

export async function saveLocale(locale: string) {
  if (!isLocale(locale)) return
  await save({ locale })
  // Remembered in the browser too, so the sign-in page and other accounts on it follow.
  ;(await cookies()).set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  revalidatePath('/', 'layout')
}

/** The name and picture shown in the app; null goes back to the Google account's. The picture is a small image as a data URL. */
export async function saveProfile(patch: { name?: string | null; avatar?: string | null }) {
  const { profile } = await mine()
  const next = { ...profile }
  if (patch.name !== undefined) next.name = [...(patch.name?.trim() ?? '')].slice(0, NAME_MAX).join('') || null
  if (patch.avatar !== undefined) next.avatar = patch.avatar && /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(patch.avatar) && patch.avatar.length <= 100_000 ? patch.avatar : null
  await save({ profile: next })
}

export async function saveDefaultProvider(provider: string) {
  await save({ defaultProvider: provider })
}

export async function saveModel(provider: string, model: string) {
  const models = { ...(await mine()).models }
  if (model.trim()) models[provider] = model.trim()
  else delete models[provider]
  await save({ models })
}

const rejected = (err: unknown) => {
  const status = (err as { status?: number })?.status
  return status === 400 || status === 401 || status === 403
}
const message = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 200)

/** Checks the key against the provider, then keeps it (and the models it can use) on this computer. */
export async function saveApiKey(provider: string, key: string): Promise<Result> {
  const t = await getT()
  key = key.trim()
  const s = await mine()
  const custom = s.customProviders.find((c) => c.id === provider)
  if ((!API_PROVIDERS.includes(provider) && !custom) || !key) return { ok: false, error: t('請貼上 API 金鑰。') }
  let known: string[] | null = null
  let note: string | undefined
  try {
    known = await listModels(provider, key, custom ? await checkServiceUrl(custom.baseUrl, authEnabled(), t) : undefined)
  } catch (err) {
    if (rejected(err)) return { ok: false, error: t('這把金鑰無效或沒有權限，所以沒有儲存。請確認複製完整。') }
    note = t('已儲存，但暫時連不上服務，無法確認金鑰。（{reason}）', { reason: message(err) })
  }
  await save({ apiKeys: { ...s.apiKeys, [provider]: key }, ...(known ? { knownModels: { ...s.knownModels, [provider]: known } } : {}) })
  return { ok: true, note }
}

export async function removeApiKey(provider: string) {
  const s = await mine()
  const apiKeys = { ...s.apiKeys }
  delete apiKeys[provider]
  await save({ apiKeys })
}

/** Asks the provider which models the key can use now, so new ones show up in the lists. */
export async function refreshModels(provider: string): Promise<Result> {
  const t = await getT()
  const key = await apiKeyOf(await currentOwner(), provider)
  const custom = (await mine()).customProviders.find((c) => c.id === provider)
  if (!key && !custom) return { ok: false, error: t('先設定 API 金鑰。') }
  try {
    const known = await listModels(provider, key ?? '', custom ? await checkServiceUrl(custom.baseUrl, authEnabled(), t) : undefined)
    const s = await mine()
    await save({ knownModels: { ...s.knownModels, [provider]: known } })
    return { ok: true, note: t('找到 {n} 個模型。', { n: known.length }) }
  } catch (err) {
    return { ok: false, error: t('無法取得模型清單：{reason}', { reason: message(err) }) }
  }
}

export async function saveAiGrading(patch: { enabled?: boolean }) {
  const current = (await mine()).aiGrading
  await save({ aiGrading: { ...current, ...patch } })
}

/** The overall AI strength, for every task without its own. */
export async function saveStrength(strength: Strength) {
  if (STRENGTHS.includes(strength)) await save({ strength })
}

/** How the 翻譯 button translates: free services, or the AI. */
export async function saveTranslationEngine(engine: 'free' | 'ai') {
  if (engine === 'free' || engine === 'ai') await save({ translationEngine: engine })
}

/** One task's own strength; null follows the overall one again. */
export async function saveTaskStrength(task: Task, strength: Strength | null) {
  if (!TASKS.includes(task) || (strength && !STRENGTHS.includes(strength))) return
  const taskStrength = { ...(await mine()).taskStrength }
  if (strength) taskStrength[task] = strength
  else delete taskStrength[task]
  await save({ taskStrength })
}

/** A model picked by hand for one task; null lets the strength choose again. */
export async function saveTaskModel(task: Task, choice: { provider: string; model: string } | null) {
  if (!TASKS.includes(task)) return
  const s = await mine()
  const taskModels = { ...s.taskModels }
  if (choice?.provider && choice.model.trim()) taskModels[task] = { provider: choice.provider, model: choice.model.trim() }
  else delete taskModels[task]
  // the older AI-marking model choice now lives here
  await save({ taskModels, ...(task === 'grading' ? { aiGrading: { ...s.aiGrading, provider: null, model: null } } : {}) })
}

/**
 * Adds a service that speaks the OpenAI format. Its address is checked first (hosted, it must
 * be public HTTPS), then its model list is fetched with the key, when it answers.
 */
export async function addCustomProvider(input: { name: string; baseUrl: string; apiKey: string }): Promise<Result & { id?: string }> {
  const t = await getT()
  const name = input.name.trim().slice(0, 60)
  if (!name) return { ok: false, error: t('請替這個服務取個名字。') }
  let baseUrl: string
  try {
    baseUrl = await checkServiceUrl(input.baseUrl, authEnabled(), t)
  } catch (err) {
    return { ok: false, error: message(err) }
  }
  const key = input.apiKey.trim()
  let known: string[] = []
  let note: string | undefined
  try {
    known = await listModels('custom', key, baseUrl)
  } catch (err) {
    if (rejected(err)) return { ok: false, error: t('服務拒絕了這把金鑰，所以沒有新增。請確認金鑰與網址。') }
    note = t('已新增，但暫時連不上服務，模型請自己輸入。（{reason}）', { reason: message(err) })
  }
  const s = await mine()
  const id = `c-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'service'}-${randomBytes(2).toString('hex')}`
  const provider: CustomProvider = { id, name, baseUrl, models: [] }
  await save({
    customProviders: [...s.customProviders, provider],
    apiKeys: key ? { ...s.apiKeys, [id]: key } : s.apiKeys,
    knownModels: { ...s.knownModels, [id]: known },
  })
  return { ok: true, id, note: note ?? (known.length ? t('找到 {n} 個模型，請挑要用的加進來。', { n: known.length }) : undefined) }
}

/** Replaces the models listed for a service the person added (tier, image support, price). */
export async function saveCustomModels(id: string, models: { id: string; tier: Tier; vision: boolean; price: { input: number; output: number } | null }[]) {
  const s = await mine()
  const customProviders = s.customProviders.map((c) => (c.id === id ? { ...c, models: models.filter((m) => m.id.trim()).slice(0, 50) } : c))
  await save({ customProviders })
}

/** Removes a service the person added, with its key and every choice that used it. */
export async function removeCustomProvider(id: string) {
  const s = await mine()
  const drop = <T,>(record: Partial<Record<string, T>>) => Object.fromEntries(Object.entries(record).filter(([k]) => k !== id)) as Record<string, T>
  const taskModels = Object.fromEntries(Object.entries(s.taskModels).filter(([, v]) => v?.provider !== id))
  await save({
    customProviders: s.customProviders.filter((c) => c.id !== id),
    apiKeys: drop(s.apiKeys),
    models: drop(s.models),
    knownModels: drop(s.knownModels),
    taskModels,
    ...(s.defaultProvider === id ? { defaultProvider: 'auto' } : {}),
  })
}
