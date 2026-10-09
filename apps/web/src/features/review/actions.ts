'use server'

import { type DraftExam, type DraftQuestion, needsAnswer, needsExplanation } from '@exam/core'
import { revalidatePath } from 'next/cache'
import { solverFor } from '@/server/ai'
import { currentOwner, keyPrefixOf, localeOf, services } from '@/server/context'
import { ownDraftFiles } from '@/server/files'
import { requireImport } from '@/server/owned'
import { getT } from '@/shared/i18n/server'

export async function saveDraft(importId: string, draft: DraftExam) {
  const imp = await requireImport(importId)
  await services().importer.saveDraft(importId, ownDraftFiles(imp.ownerId, draft))
}

/** Puts the reviewed questions into the bank; saving again replaces them. */
export async function publishDraft(importId: string, draft: DraftExam): Promise<{ count: number; examId: string }> {
  const imp = await requireImport(importId)
  const exam = await services().importer.publish(importId, ownDraftFiles(imp.ownerId, draft))
  revalidatePath('/bank')
  revalidatePath(`/bank/exams/${exam.id}`)
  revalidatePath('/imports')
  revalidatePath(`/imports/${importId}`)
  return { count: exam.questionCount, examId: exam.id }
}

/**
 * What the AI adds to one question on request: `answer` works out the key the paper left out,
 * `explain` writes a worked explanation for the key. The question comes from the editor (it may
 * have unsaved edits); only figures in the person's own files are read.
 */
export async function solveQuestion(importId: string, job: 'answer' | 'explain', question: DraftQuestion, shared: string | null, again = false): Promise<{ values: string[] } | { explanation: string } | { error: string }> {
  await requireImport(importId)
  const t = await getT()
  // `again`: asked for this one question, so a key or explanation already there is redone.
  if (!again && (job === 'answer' ? !needsAnswer(question) : !needsExplanation(question))) return { error: t('這題不需要了。') }
  if (job === 'explain' && !question.answer.values.some((v) => v.trim())) return { error: t('先填好答案，或先讓 AI 作答，再寫詳解。') }
  const owner = await currentOwner()
  const prefix = keyPrefixOf(owner)
  const { files } = services()
  const keys = question.figures.flatMap((f) => (f.image && f.image.file.startsWith(prefix) ? [f.image.file] : []))
  const images = (await Promise.all(keys.map((k) => files.read(k)))).filter((b): b is Buffer => Boolean(b))
  // a question with pictures goes to a model that sees them (settings: 有圖的題目)
  const solver = await solverFor(owner, job === 'answer' ? 'solving' : 'explaining', images.length > 0)
  if (!solver) return { error: t('還沒有 API 金鑰：先到設定加上任一家的金鑰。') }
  const req = { question, shared, images, language: await localeOf(owner) }
  try {
    return job === 'answer' ? { values: await solver.solve(req) } : { explanation: await solver.explain(req) }
  } catch (err) {
    console.error(`[review] AI could not ${job} a question`, err)
    return { error: t('AI 這題沒有做出來，可以再試一次或自己填。') }
  }
}
