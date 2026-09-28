'use server'

import type { DraftExam } from '@exam/core'
import { revalidatePath } from 'next/cache'
import { services } from '@/server/context'

export async function saveDraft(importId: string, draft: DraftExam) {
  services().importer.saveDraft(importId, draft)
}

/** Puts the reviewed questions into the bank; saving again replaces them. */
export async function publishDraft(importId: string, draft: DraftExam): Promise<{ count: number }> {
  const saved = services().importer.publish(importId, draft)
  revalidatePath('/bank')
  revalidatePath('/imports')
  revalidatePath(`/imports/${importId}`)
  return { count: saved.length }
}
