'use server'

import { randomBytes } from 'node:crypto'
import { listModels } from '@exam/extraction'
import type { Strength, Task, Tier } from '@exam/models'
import type { CustomProvider } from '@exam/settings'
import { revalidatePath } from 'next/cache'
import { apiKeyOf, authEnabled, currentOwner, services } from '@/server/context'
import { checkServiceUrl } from '@/server/serviceUrl'

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
  await save({ locale })
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
  key = key.trim()
  const s = await mine()
  const custom = s.customProviders.find((c) => c.id === provider)
  if ((!API_PROVIDERS.includes(provider) && !custom) || !key) return { ok: false, error: '請貼上 API 金鑰。' }
  let known: string[] | null = null
  let note: string | undefined
  try {
    known = await listModels(provider, key, custom ? await checkServiceUrl(custom.baseUrl, authEnabled()) : undefined)
  } catch (err) {
    if (rejected(err)) return { ok: false, error: '這把金鑰無效或沒有權限，所以沒有儲存。請確認複製完整。' }
    note = `已儲存，但暫時連不上服務，無法確認金鑰。（${message(err)}）`
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
  const key = await apiKeyOf(await currentOwner(), provider)
  const custom = (await mine()).customProviders.find((c) => c.id === provider)
  if (!key && !custom) return { ok: false, error: '先設定 API 金鑰。' }
  try {
    const known = await listModels(provider, key ?? '', custom ? await checkServiceUrl(custom.baseUrl, authEnabled()) : undefined)
    const s = await mine()
    await save({ knownModels: { ...s.knownModels, [provider]: known } })
    return { ok: true, note: `找到 ${known.length} 個模型。` }
  } catch (err) {
    return { ok: false, error: `無法取得模型清單：${message(err)}` }
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
  const name = input.name.trim().slice(0, 60)
  if (!name) return { ok: false, error: '請替這個服務取個名字。' }
  let baseUrl: string
  try {
    baseUrl = await checkServiceUrl(input.baseUrl, authEnabled())
  } catch (err) {
    return { ok: false, error: message(err) }
  }
  const key = input.apiKey.trim()
  let known: string[] = []
  let note: string | undefined
  try {
    known = await listModels('custom', key, baseUrl)
  } catch (err) {
    if (rejected(err)) return { ok: false, error: '服務拒絕了這把金鑰，所以沒有新增。請確認金鑰與網址。' }
    note = `已新增，但暫時連不上服務，模型請自己輸入。（${message(err)}）`
  }
  const s = await mine()
  const id = `c-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'service'}-${randomBytes(2).toString('hex')}`
  const provider: CustomProvider = { id, name, baseUrl, models: [] }
  await save({
    customProviders: [...s.customProviders, provider],
    apiKeys: key ? { ...s.apiKeys, [id]: key } : s.apiKeys,
    knownModels: { ...s.knownModels, [id]: known },
  })
  return { ok: true, id, note: note ?? (known.length ? `找到 ${known.length} 個模型，請挑要用的加進來。` : undefined) }
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
