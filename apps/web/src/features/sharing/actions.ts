'use server'

import { randomUUID } from 'node:crypto'
import type { DraftFigure, DraftQuestion } from '@exam/core'
import { draftOf } from '@exam/bank'
import type { QuizMode } from '@exam/quiz'
import type { AnswerRelease } from '@exam/sharing'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { startQuiz } from '@/features/quiz/start'
import { currentOwner, keyPrefixOf, services } from '@/server/context'
import { noRoomFor } from '@/server/storage'
import { ownedExam } from '@/server/owned'
import { openShare } from '@/server/shared'
import { getT } from '@/shared/i18n/server'

const RELEASES: AnswerRelease[] = ['after_submit', 'never']

async function myExam(examId: string) {
  const exam = await ownedExam(examId)
  if (!exam) {
    const t = await getT()
    throw new Error(t('找不到這份考卷'))
  }
  return exam
}

/** Opens the exam's link (or keeps the open one) with when its answers show and whether it may be copied. */
export async function shareExam(examId: string, answers: AnswerRelease, allowCopy: boolean): Promise<{ token: string }> {
  const exam = await myExam(examId)
  if (!RELEASES.includes(answers)) {
    const t = await getT()
    throw new Error(t('不明的答案設定'))
  }
  const share = await services().shares.open(exam.id, exam.ownerId, answers, allowCopy)
  revalidatePath(`/bank/exams/${exam.id}`)
  return { token: share.token }
}

/** Closes the link: it stops working at once. Sharing again makes a new link. */
export async function closeShare(examId: string): Promise<void> {
  const exam = await myExam(examId)
  await services().shares.close(exam.id)
  revalidatePath(`/bank/exams/${exam.id}`)
}

/** Starts practice or an exam on a shared exam; the attempt is the visitor's own. */
export async function startShared(token: string, mode: QuizMode, shuffle: { questions: boolean; options: boolean }): Promise<{ error: string } | undefined> {
  const opened = await openShare(token)
  const t = await getT()
  if (!opened) return { error: t('這個連結已經關閉了。') }
  if (!opened.questions.length) return { error: t('這份考卷還沒有題目。') }
  const attempt = await startQuiz({
    ownerId: await currentOwner(),
    questions: opened.questions,
    settings: { mode, shuffleQuestions: shuffle.questions, shuffleOptions: shuffle.options, timeLimitMinutes: null, multiplePartial: opened.exam.multiplePartial, keyHidden: opened.share.answers === 'never' },
    share: token,
  })
  revalidatePath('/quiz')
  redirect(`/quiz/${attempt.id}`)
}

/**
 * "加到我的題庫": an editable copy of the shared exam in the visitor's own bank. Figure
 * images are copied too, so the copy keeps working after the link closes. The answer
 * key is left out when the owner keeps it private.
 */
export async function copyShared(token: string): Promise<{ error: string } | undefined> {
  const opened = await openShare(token)
  const t = await getT()
  if (!opened) return { error: t('這個連結已經關閉了。') }
  if (!opened.share.allowCopy) return { error: t('分享的人沒有開放加到題庫。') }
  const owner = await currentOwner()
  const { bank, files, shares } = services()
  // The copy's figures count toward the account (each one is stored once all the same).
  const figureCount = opened.questions.reduce((n, q) => n + q.figures.length, 0) + opened.exam.groups.reduce((n, g) => n + g.figures.length, 0)
  const full = await noRoomFor(owner, figureCount * 50_000)
  if (full) return { error: full }
  // The folder is named after the copy, so a link to the copy can open its figures (see server/shared.ts).
  const examId = randomUUID()
  const folder = `${keyPrefixOf(owner)}copies/${examId}`
  let n = 0
  const copyFigure = async (f: DraftFigure): Promise<DraftFigure> => {
    if (!f.image) return f
    const data = await files.read(f.image.file)
    if (!data) return { ...f, image: null }
    const file = `${folder}/figure-${++n}.png`
    await files.write(file, data)
    return { ...f, image: { ...f.image, file } }
  }
  const keepKey = opened.share.answers !== 'never'
  const questions: DraftQuestion[] = []
  for (const q of opened.questions) {
    const draft = draftOf(q)
    questions.push({
      ...draft,
      figures: await Promise.all(draft.figures.map(copyFigure)),
      // a writing practice keeps its characters: they are the question, not the answer
      ...(!keepKey && { answer: draft.type === 'writing' ? { ...draft.answer, source: 'none' as const } : { values: [], source: 'none' as const }, explanation: null }),
      // The copy has no pages to point at.
      locations: [],
    })
  }
  const groups = await Promise.all(opened.exam.groups.map(async (g) => ({ ...g, figures: await Promise.all(g.figures.map(copyFigure)) })))
  const { title, subject, institution, term, language } = opened.exam
  const exam = await bank.createExam(owner, { id: examId, meta: { title, subject, institution, term, language }, groups, questions })
  await shares.recordCopy(token, owner, exam.id)
  revalidatePath('/bank')
  redirect(`/bank/exams/${exam.id}`)
}
