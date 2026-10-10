'use server'

import { isUsableQuad, type Quad } from '@exam/core'
import { services } from '@/server/context'
import { requireImport } from '@/server/owned'

/**
 * Cuts a page of the original along `quad` (corners on the photo as taken; null: the whole photo) and
 * flattens it. Returns the corners it had before, for 復原 and for moving the draft's boxes with it.
 */
export async function cropPage(importId: string, pageNumber: number, quad: Quad | null): Promise<{ before: Quad | null }> {
  const imp = await requireImport(importId)
  if (quad && !isUsableQuad(quad)) throw new Error('Unusable corners')
  return { before: await services().importer.crops.set(imp, pageNumber, quad) }
}

/** Where the sheet of paper is on a page's photo, found on the server (no AI); null when it is not clear. */
export async function findPageCorners(importId: string, pageNumber: number): Promise<Quad | null> {
  const imp = await requireImport(importId)
  return services().importer.crops.detect(imp, pageNumber)
}
