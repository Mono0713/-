'use server'

import type { DraftFigure } from '@exam/core'
import { currentOwner, services } from '@/server/context'
import { ownedImport } from '@/server/owned'
import { noRoomFor } from '@/server/storage'
import { getT } from '@/shared/i18n/server'

/** Crops a figure again from its original page with its current box and blank settings. */
export async function recropFigure(importId: string, figure: DraftFigure): Promise<DraftFigure> {
  const imp = await ownedImport(importId)
  if (!imp) {
    const t = await getT()
    throw new Error(t('原始考卷已刪除，無法重新裁切'))
  }
  return services().importer.recropFigure(importId, figure)
}

/** Most a picture uploaded for one figure may weigh. */
const MAX_UPLOAD = 15 * 1024 * 1024

/** Stores a picture uploaded to replace a figure's image or to add one. */
export async function uploadFigureImage(importId: string, form: FormData): Promise<{ image: NonNullable<DraftFigure['image']> } | { error: string }> {
  const t = await getT()
  if (!(await ownedImport(importId))) return { error: t('原始考卷已刪除，無法加圖片。') }
  const file = form.get('image')
  if (!(file instanceof File) || !file.size) return { error: t('沒有收到圖片。') }
  if (!file.type.startsWith('image/')) return { error: t('只能放圖片檔（PNG、JPG、WebP）。') }
  if (file.size > MAX_UPLOAD) return { error: t('圖片太大了，請小於 15 MB。') }
  const full = await noRoomFor(await currentOwner(), file.size)
  if (full) return { error: full }
  try {
    return { image: await services().importer.uploadFigure(importId, Buffer.from(await file.arrayBuffer())) }
  } catch (err) {
    console.error('[questions] figure upload failed', err)
    return { error: t('這張圖片讀不出來，換一張試試。') }
  }
}
