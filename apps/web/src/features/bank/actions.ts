'use server'

import type { DraftQuestion, ExamMeta } from '@exam/core'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { services } from '@/server/context'
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

export async function deleteBankQuestion(id: string) {
  const q = await requireQuestion(id)
  await services().bank.deleteQuestion(id)
  revalidatePath('/bank')
  redirect(`/bank/exams/${q.examId}`)
}

export async function updateExamMeta(id: string, meta: Partial<ExamMeta>) {
  await requireExam(id)
  await services().bank.updateExam(id, meta)
  revalidatePath('/bank')
  revalidatePath(`/bank/exams/${id}`)
}

export async function deleteExam(id: string) {
  await requireExam(id)
  await services().bank.deleteExam(id)
  revalidatePath('/bank')
  redirect('/bank')
}
