'use server'

import { listModels } from '@exam/extraction'
import { revalidatePath } from 'next/cache'
import { apiKeyOf, currentOwner, services } from '@/server/context'

type Result = { ok: true; note?: string } | { ok: false; error: string }

const API_PROVIDERS = ['claude', 'openai', 'gemini']

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
  if (!API_PROVIDERS.includes(provider) || !key) return { ok: false, error: '請貼上 API 金鑰。' }
  const s = await mine()
  let known: string[] | null = null
  let note: string | undefined
  try {
    known = await listModels(provider, key)
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
  if (!key) return { ok: false, error: '先設定 API 金鑰。' }
  try {
    const known = await listModels(provider, key)
    const s = await mine()
    await save({ knownModels: { ...s.knownModels, [provider]: known } })
    return { ok: true, note: `找到 ${known.length} 個模型。` }
  } catch (err) {
    return { ok: false, error: `無法取得模型清單：${message(err)}` }
  }
}

export async function saveAiGrading(patch: { enabled?: boolean; provider?: string | null; model?: string | null }) {
  const current = (await mine()).aiGrading
  await save({ aiGrading: { ...current, ...patch } })
}
