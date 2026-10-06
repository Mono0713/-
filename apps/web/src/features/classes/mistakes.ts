'use server'

import { missedQuestions } from '@exam/classes'
import { redirect } from 'next/navigation'
import { startFromSources } from '@/features/quiz/start'
import { inAssignment, resultsWithheld } from '@/server/classes'
import { services } from '@/server/context'
import { getT } from '@/shared/i18n/server'

/**
 * A student practises the questions they lost points on in their last handed-in paper of an
 * assignment, once its answers are out: a practice quiz of their own, outside the class.
 */
export async function practiceMistakes(assignmentId: string): Promise<{ error: string } | undefined> {
  const t = await getT()
  const found = await inAssignment(assignmentId)
  if (!found || found.teaches) return { error: t('找不到這份作業') }
  const { assignment, me } = found
  const { classes, quizzes } = services()
  const tries = (await Promise.all((await classes.attempts(assignment.id, me.userId)).filter((x) => !x.preview).map((x) => quizzes.get(x.attemptId)))).filter((x) => x !== null)
  const last = tries.filter((x) => x.finishedAt).sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!)).at(-1)
  if (!last || (await resultsWithheld(last))) return { error: t('老師公布答案後才能練習錯題') }
  const missed = new Set(missedQuestions(last))
  const sources = assignment.sources.filter((s) => missed.has(s.questionId))
  if (!sources.length) return { error: t('這次沒有錯題') }
  const attempt = await startFromSources({
    ownerId: me.userId,
    title: t('{title} 錯題練習', { title: assignment.title }),
    examIds: [],
    sources,
    settings: { mode: 'practice', shuffleQuestions: false, shuffleOptions: true, timeLimitMinutes: null, multiplePartial: assignment.settings.multiplePartial },
  })
  redirect(`/quiz/${attempt.id}`)
}
