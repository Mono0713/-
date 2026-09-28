'use server'

import type { DraftQuestion } from '@exam/core'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { currentOwner, services } from '@/server/context'

function owned(id: string) {
  const q = services().bank.getQuestion(id)
  if (!q || q.ownerId !== currentOwner()) throw new Error('Question not found')
  return q
}

export async function updateBankQuestion(id: string, question: DraftQuestion, subject: string | null) {
  owned(id)
  services().bank.updateQuestion(id, { ...question, subject })
  revalidatePath('/bank')
}

export async function deleteBankQuestion(id: string) {
  owned(id)
  services().bank.deleteQuestion(id)
  revalidatePath('/bank')
  redirect('/bank')
}
