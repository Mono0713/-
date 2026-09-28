'use server'

import type { DraftFigure } from '@exam/core'
import { currentOwner, services } from '@/server/context'

/** Crops a figure again from its original page with its current blank settings. */
export async function recropFigure(importId: string, figure: DraftFigure): Promise<DraftFigure> {
  const imp = services().bank.getImport(importId)
  if (!imp || imp.ownerId !== currentOwner()) throw new Error('原始考卷已刪除，無法重新裁切')
  return services().importer.recropFigure(importId, figure)
}
