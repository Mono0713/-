'use server'

import { revalidatePath } from 'next/cache'
import { services } from '@/server/context'
import { requireImport } from '@/server/owned'
import { noRoomFor } from '@/server/storage'
import { getT } from '@/shared/i18n/server'

/**
 * Puts the original's pages in `order` (`order[i]`: the page now at i + 1); the saved draft and the
 * page readings follow. Returns the pages as now shown.
 */
export async function reorderPages(importId: string, order: number[]) {
  const imp = await requireImport(importId)
  const { importer } = services()
  await importer.reorderPages(importId, order)
  return importer.sourcePages(imp)
}

/** Adds more PDF files or photos after the last page and reads only them; the editor then shows the reading. */
export async function addPages(importId: string, formData: FormData): Promise<{ error: string } | void> {
  const t = await getT()
  const imp = await requireImport(importId)
  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) return { error: t('請選擇至少一個 PDF 或圖片檔。') }
  const full = await noRoomFor(imp.ownerId, files.reduce((n, f) => n + f.size, 0))
  if (full) return { error: full }
  try {
    await services().importer.addPages(importId, await Promise.all(files.map(async (f) => ({ name: f.name, data: Buffer.from(await f.arrayBuffer()) }))))
  } catch (err) {
    console.error('[import] could not add pages', err)
    const reason = err instanceof Error ? err.message : String(err)
    return { error: t('無法讀取檔案：{reason}', { reason }) }
  }
  revalidatePath(`/imports/${importId}`)
}
