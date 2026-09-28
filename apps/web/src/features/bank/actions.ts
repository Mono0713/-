'use server'

import type { DraftQuestion, ExamMeta } from '@exam/core'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { currentOwner, services } from '@/server/context'

function ownedQuestion(id: string) {
  const q = services().bank.getQuestion(id)
  if (!q || q.ownerId !== currentOwner()) throw new Error('Question not found')
  return q
}

function ownedExam(id: string) {
  const exam = services().bank.getExam(id)
  if (!exam || exam.ownerId !== currentOwner()) throw new Error('Exam not found')
  return exam
}

export async function updateBankQuestion(id: string, question: DraftQuestion) {
  const q = ownedQuestion(id)
  services().bank.updateQuestion(id, question)
  revalidatePath(`/bank/exams/${q.examId}`)
}

export async function deleteBankQuestion(id: string) {
  const q = ownedQuestion(id)
  services().bank.deleteQuestion(id)
  revalidatePath('/bank')
  redirect(`/bank/exams/${q.examId}`)
}

export async function updateExamMeta(id: string, meta: Partial<ExamMeta>) {
  ownedExam(id)
  services().bank.updateExam(id, meta)
  revalidatePath('/bank')
  revalidatePath(`/bank/exams/${id}`)
}

export async function deleteExam(id: string) {
  ownedExam(id)
  services().bank.deleteExam(id)
  revalidatePath('/bank')
  redirect('/bank')
}
