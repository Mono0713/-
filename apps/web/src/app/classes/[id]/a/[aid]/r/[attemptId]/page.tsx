import { summarize } from '@exam/quiz'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { IntegrityLog } from '@/features/classes/IntegrityLog'
import { LocalTime } from '@/features/classes/LocalTime'
import { TeacherReview } from '@/features/classes/TeacherReview'
import { taughtAttempt } from '@/server/classes'
import { services } from '@/server/context'
import { rich } from '@/shared/i18n/rich'
import { getT } from '@/shared/i18n/server'
import { Card, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const t = await getT()
  return { title: t('批改') }
}

/** A student's handed-in work, opened by the class's teacher or an assistant to mark. */
export default async function ReviewPage({ params }: { params: Promise<{ id: string; aid: string; attemptId: string }> }) {
  const { id, aid, attemptId } = await params
  const t = await getT()
  const found = await taughtAttempt(attemptId)
  if (!found || found.assignment.id !== aid || found.in.classroom.id !== id || !found.attempt.finishedAt) notFound()
  const { attempt, assignment } = found
  const student = await services().classes.member(id, attempt.ownerId)
  const summary = summarize(attempt)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={student?.name ?? t('已退出的學生')}
        subtitle={
          <Link href={`/classes/${id}/a/${aid}`} className="hover:underline">
            {assignment.title}
          </Link>
        }
      />
      <Card className="mb-4 flex flex-wrap items-baseline gap-x-8 gap-y-2 p-5">
        <div>
          <p className="text-xs text-muted">{t('得分')}</p>
          <p className="num text-3xl">
            {Number.isInteger(summary.score) ? summary.score : summary.score.toFixed(1)}
            <span className="text-lg text-muted"> / {summary.max}</span>
          </p>
        </div>
        <p className="text-sm text-muted">
          {rich(t('交卷 <time></time>'), { time: () => <LocalTime at={attempt.finishedAt!} /> })}
        </p>
      </Card>
      {attempt.settings.mode === 'exam' && <IntegrityLog events={attempt.integrity ?? []} t={t} />}
      <TeacherReview attempt={attempt} summary={summary} />
    </div>
  )
}
