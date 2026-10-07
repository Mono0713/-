'use server'

import type { ExamPatch } from '@exam/bank'
import type { DraftQuestion } from '@exam/core'
import { revalidatePath } from 'next/cache'
import { currentOwner, services } from '@/server/context'
import { ownedExam, ownedQuestion } from '@/server/owned'

async function requireQuestion(id: string) {
  const q = await ownedQuestion(id)
  if (!q) throw new Error('Question not found')
  return q
}

async function requireExam(id: string) {
  const exam = await ownedExam(id)
  if (!exam) throw new Error('Exam not found')
  return exam
}

export async function updateBankQuestion(id: string, question: DraftQuestion) {
  const q = await requireQuestion(id)
  await services().bank.updateQuestion(id, question)
  revalidatePath(`/bank/exams/${q.examId}`)
}

/** Deletes for good; the 復原 note calls it once it has run out. */
export async function deleteBankQuestion(id: string) {
  const q = await requireQuestion(id)
  await services().bank.deleteQuestion(id)
  revalidatePath('/bank')
  revalidatePath(`/bank/exams/${q.examId}`)
}

export async function updateExamMeta(id: string, patch: ExamPatch) {
  await requireExam(id)
  const { multiplePartial, ...meta } = patch
  await services().bank.updateExam(id, { ...meta, ...(multiplePartial !== undefined && { multiplePartial: Boolean(multiplePartial) }) })
  revalidatePath('/bank')
  revalidatePath(`/bank/exams/${id}`)
}

/** Deletes for good; the 復原 note calls it once it has run out. */
/** Saves the order the person dragged their cards into. */
export async function reorderExams(ids: string[]) {
  await services().bank.reorderExams(await currentOwner(), ids)
}

export async function deleteExam(id: string) {
  await requireExam(id)
  await services().bank.deleteExam(id)
  revalidatePath('/bank')
}
