'use server'

import type { DraftFigure } from '@exam/core'
import { services } from '@/server/context'
import { ownedImport } from '@/server/owned'
import { getT } from '@/shared/i18n/server'

/** Crops a figure again from its original page with its current blank settings. */
export async function recropFigure(importId: string, figure: DraftFigure): Promise<DraftFigure> {
  const imp = await ownedImport(importId)
  if (!imp) {
    const t = await getT()
    throw new Error(t('原始考卷已刪除，無法重新裁切'))
  }
  return services().importer.recropFigure(importId, figure)
}
