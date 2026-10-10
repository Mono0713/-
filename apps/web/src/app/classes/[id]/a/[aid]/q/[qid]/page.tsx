import { assignmentStats } from '@exam/classes'
import { summarize, type QuizItem } from '@exam/quiz'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { QuestionMarking, type StudentAnswer } from '@/features/classes/QuestionMarking'
import { inAssignment } from '@/server/classes'
import { services } from '@/server/context'
import { getT } from '@/shared/i18n/server'
import { IconChevronLeft, IconChevronRight } from '@/shared/icons'
import { PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const t = await getT()
  return { title: t('逐題批改') }
}

/** One question of an assignment with every student's answer to it, to read and mark one after another. */
export default async function QuestionPage({ params }: { params: Promise<{ id: string; aid: string; qid: string }> }) {
  const { id, aid, qid } = await params
  const t = await getT()
  const found = await inAssignment(aid)
  if (!found?.teaches || found.classroom.id !== id) notFound()
  const { assignment: a, classroom } = found
  const at = a.sources.findIndex((s) => s.questionId === qid)
  if (at < 0) notFound()
  const source = a.sources[at]!
  const { classes, quizzes } = services()
  const [members, tries] = await Promise.all([classes.members(classroom.id), classes.attempts(a.id)])
  const attempts = (await Promise.all(tries.filter((x) => !x.preview).map((x) => quizzes.get(x.attemptId)))).filter((x) => x !== null)
  const stats = assignmentStats(a.sources, members, attempts)
  const byId = new Map(stats.counted.map((x) => [x.id, x]))

  const answers = stats.students.flatMap((r): StudentAnswer[] => {
    const attempt = r.counted?.handedIn ? byId.get(r.counted.attemptId) : undefined
    const index = attempt?.items.findIndex((item) => item.questionId === qid) ?? -1
    if (!attempt || index < 0) return []
    return [{ name: r.left ? t('已退出的學生') : r.name, attemptId: attempt.id, index, item: attempt.items[index]!, response: attempt.responses[index] ?? null, marking: attempt.markings[index] ?? null, grade: summarize(attempt).grades[index]! }]
  })
  // The question as printed, options in their own order and labels, to read the answers against.
  const labels = source.question.options.map((o) => o.label)
  const paper: QuizItem = { questionId: qid, question: source.question, group: source.group, optionOrder: labels, displayLabels: labels }
  const base = `/classes/${classroom.id}/a/${a.id}`
  const prev = a.sources[at - 1]
  const next = a.sources[at + 1]
  const step = 'm-press flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent/50'

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('第 {n} 題', { n: source.question.number })}
        subtitle={
          <Link href={base} className="hover:underline">
            {a.title}
          </Link>
        }
        actions={
          <div className="flex gap-2">
            {prev && (
              <Link href={`${base}/q/${prev.questionId}`} className={step}>
                <IconChevronLeft size={16} /> {t('第 {n} 題', { n: prev.question.number })}
              </Link>
            )}
            {next && (
              <Link href={`${base}/q/${next.questionId}`} className={step}>
                {t('第 {n} 題', { n: next.question.number })} <IconChevronRight size={16} />
              </Link>
            )}
          </div>
        }
      />
      <QuestionMarking paper={paper} position={at} answers={answers} reviewBase={`${base}/r`} />
    </div>
  )
}
