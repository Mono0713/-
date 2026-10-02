'use server'

import type { DraftExam } from '@exam/core'
import { revalidatePath } from 'next/cache'
import { services } from '@/server/context'
import { requireImport } from '@/server/owned'

export async function saveDraft(importId: string, draft: DraftExam) {
  await requireImport(importId)
  await services().importer.saveDraft(importId, draft)
}

/** Puts the reviewed questions into the bank; saving again replaces them. */
export async function publishDraft(importId: string, draft: DraftExam): Promise<{ count: number; examId: string }> {
  await requireImport(importId)
  const exam = await services().importer.publish(importId, draft)
  revalidatePath('/bank')
  revalidatePath(`/bank/exams/${exam.id}`)
  revalidatePath('/imports')
  revalidatePath(`/imports/${importId}`)
  return { count: exam.questionCount, examId: exam.id }
}
