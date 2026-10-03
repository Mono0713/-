'use server'

import { extractJson } from '@exam/extraction'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { currentOwner, services } from '@/server/context'
import { requireImport } from '@/server/owned'

export async function createImport(formData: FormData): Promise<{ error: string } | void> {
  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) return { error: '請選擇至少一個 PDF 或圖片檔。' }
  const provider = String(formData.get('provider') ?? 'manual')
  const model = String(formData.get('model') ?? '').trim() || null
  let id: string
  try {
    const record = await services().importer.create({
      ownerId: await currentOwner(),
      provider,
      model,
      files: await Promise.all(files.map(async (f) => ({ name: f.name, data: Buffer.from(await f.arrayBuffer()) }))),
    })
    id = record.id
  } catch (err) {
    return { error: `無法讀取檔案：${err instanceof Error ? err.message : String(err)}` }
  }
  revalidatePath('/imports')
  redirect(`/imports/${id}`)
}

/** Saves a reply pasted from a chat app and re-reads those pages. */
export async function submitManualReply(importId: string, target: number | 'batch', text: string): Promise<{ error: string } | void> {
  await requireImport(importId)
  const json = extractJson(text)
  try {
    JSON.parse(json ?? '')
  } catch {
    return { error: '貼上的內容不是完整的 JSON。請確認把聊天回覆從第一個 { 到最後一個 } 都複製到了。' }
  }
  await services().importer.submitManualReply(importId, target, json!)
  revalidatePath(`/imports/${importId}`)
}

/** Reads the given pages again (all when empty), optionally with another model. */
export async function rerunImport(importId: string, opts: { provider?: string; model?: string | null; pages?: number[] }) {
  await requireImport(importId)
  await services().importer.rerun(importId, opts)
  revalidatePath(`/imports/${importId}`)
}

/** Deletes for good; the 復原 note calls it once it has run out. */
export async function deleteImport(importId: string) {
  await requireImport(importId)
  await services().importer.remove(importId)
  revalidatePath('/imports')
}

/** Keeps the uploaded files past the 30 days after saving, or lets them go again. */
export async function keepOriginal(importId: string, keep: boolean): Promise<void> {
  await requireImport(importId)
  await services().bank.updateImport(importId, { keepOriginal: keep })
  revalidatePath(`/imports/${importId}`)
}
