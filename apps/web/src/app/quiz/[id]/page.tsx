import { isOver, summarize } from '@exam/quiz'
import { notFound } from 'next/navigation'
import { DeleteQuizButton } from '@/features/quiz/DeleteQuizButton'
import { QuizPlayer } from '@/features/quiz/QuizPlayer'
import { QuizResults } from '@/features/quiz/QuizResults'
import { startTeacher } from '@/features/quiz/teacher'
import { hiddenItem } from '@/features/quiz/visible'
import { currentOwner, services, teacherFor } from '@/server/context'
import { ButtonLink, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { quizzes } = services()
  let attempt = quizzes.get(id)
  if (!attempt || attempt.ownerId !== currentOwner()) notFound()

  // A timed exam left open past its deadline is handed in as it stands.
  if (!attempt.finishedAt && isOver(attempt)) {
    quizzes.save({ ...attempt, finishedAt: attempt.deadline })
    startTeacher(id)
    attempt = quizzes.get(id)!
  }

  const mode = attempt.settings.mode === 'exam' ? '考試' : '單題練習'
  const retry = attempt.examIds.length === 1 ? `/quiz/new?exam=${attempt.examIds[0]}` : '/quiz/new'

  if (attempt.finishedAt) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title={attempt.title}
          subtitle={`${mode} · ${attempt.items.length} 題 · ${new Date(attempt.startedAt).toLocaleString('zh-TW')}`}
          actions={
            <>
              <DeleteQuizButton quizId={attempt.id} />
              <ButtonLink href={retry} variant="primary">
                再測一次
              </ButtonLink>
            </>
          }
        />
        <QuizResults attempt={attempt} summary={summarize(attempt)} teacher={teacherFor(attempt.ownerId) !== null} />
      </div>
    )
  }

  // Answers stay on the server until a question is checked or the quiz is handed in.
  const visible = { ...attempt, items: attempt.items.map((item, i) => (attempt.checked[i] ? item : hiddenItem(item))) }
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={attempt.title} subtitle={`${mode} · ${attempt.items.length} 題`} />
      <QuizPlayer attempt={visible} />
    </div>
  )
}
