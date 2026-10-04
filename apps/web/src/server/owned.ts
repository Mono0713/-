import type { BankExam, BankQuestion, ImportRecord } from '@exam/bank'
import type { QuizAttempt } from '@exam/quiz'
import { currentOwner } from './auth'
import { services } from './context'
import { getT } from '@/shared/i18n/server'

/**
 * Things looked up by an id from the address bar or a form, only when they belong
 * to the signed-in person; null otherwise, so another person's id finds nothing.
 * Every page and action that takes an id goes through these.
 */

export async function ownedImport(id: string): Promise<ImportRecord | null> {
  const [owner, imp] = await Promise.all([currentOwner(), services().bank.getImport(id)])
  return imp?.ownerId === owner ? imp : null
}

export async function ownedExam(id: string): Promise<BankExam | null> {
  const [owner, exam] = await Promise.all([currentOwner(), services().bank.getExam(id)])
  return exam?.ownerId === owner ? exam : null
}

export async function ownedQuestion(id: string): Promise<BankQuestion | null> {
  const [owner, q] = await Promise.all([currentOwner(), services().bank.getQuestion(id)])
  return q?.ownerId === owner ? q : null
}

export async function ownedAttempt(id: string): Promise<QuizAttempt | null> {
  const [owner, attempt] = await Promise.all([currentOwner(), services().quizzes.get(id)])
  return attempt?.ownerId === owner ? attempt : null
}

/** For actions: the import, or an error when it is not the person's. */
export async function requireImport(id: string): Promise<ImportRecord> {
  const imp = await ownedImport(id)
  if (!imp) {
    const t = await getT()
    throw new Error(t('找不到這份上傳的考卷'))
  }
  return imp
}
