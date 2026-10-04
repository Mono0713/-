import { isOver, summarize } from '@exam/quiz'
import { notFound } from 'next/navigation'
import { DeleteQuizButton } from '@/features/quiz/DeleteQuizButton'
import { Removable } from '@/shared/removal'
import { QuizPlayer } from '@/features/quiz/QuizPlayer'
import { QuizResults } from '@/features/quiz/QuizResults'
import { startTeacher } from '@/features/quiz/teacher'
import { hiddenItem, revealedItem } from '@/features/quiz/visible'
import { graderFor, keyRule, resultsWithheld, selfMarks } from '@/server/classes'
import { localeOf, services } from '@/server/context'
import { ownedAttempt } from '@/server/owned'
import { getLocale, getT } from '@/shared/i18n/server'
import { intlTag } from '@/shared/i18n/locales'
import { HandedIn } from '@/features/classes/HandedIn'
import { ButtonLink, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { quizzes } = services()
  const t = await getT()
  let attempt = await ownedAttempt(id)
  if (!attempt) notFound()

  // A timed exam left open past its deadline is handed in as it stands.
  if (!attempt.finishedAt && isOver(attempt)) {
    await quizzes.update(id, (now) => (now.finishedAt ? null : { ...now, finishedAt: now.deadline }))
    await startTeacher(id)
    attempt = (await quizzes.get(id))!
  }

  const mode = attempt.settings.mode === 'exam' ? t('考試') : t('單題練習')
  const assignment = attempt.assignment ? `/classes/${attempt.assignment.classId}/a/${attempt.assignment.assignmentId}` : null
  const retry = assignment ?? (attempt.share ? `/s/${attempt.share}` : attempt.examIds.length === 1 ? `/quiz/new?exam=${attempt.examIds[0]}` : '/quiz/new')
  const key = await keyRule(attempt)
  // Handed in to a class: it stays for the teacher, so it cannot be deleted.
  const deletable = selfMarks(attempt)

  // Deleting it goes back to the list; the page empties at once rather than waiting for the list to load.
  if (attempt.finishedAt) {
    return (
      <Removable id={attempt.id}>
      <div className="mx-auto max-w-4xl">
        <PageHeader
          title={attempt.title}
          subtitle={t('{mode} · {n} 題 · {date}', { mode, n: attempt.items.length, date: new Date(attempt.startedAt).toLocaleString(intlTag(await getLocale())) })}
          actions={
            <>
              {deletable && <DeleteQuizButton quizId={attempt.id} />}
              <ButtonLink href={retry} variant="primary">
                {assignment ? t('回到作業') : t('再測一次')}
              </ButtonLink>
            </>
          }
        />
        {(await resultsWithheld(attempt)) ? (
          <HandedIn finishedAt={attempt.finishedAt} opensAt={key.keyHidden ? null : (key.keyUntil ?? null)} />
        ) : (
          <QuizResults attempt={{ ...attempt, items: attempt.items.map((item) => revealedItem(item, key)) }} summary={summarize(attempt)} teacher={(await graderFor(attempt)) !== null} locale={await localeOf(attempt.ownerId)} />
        )}
      </div>
      </Removable>
    )
  }

  // Answers stay on the server until a question is checked or the quiz is handed in.
  const visible = { ...attempt, items: attempt.items.map((item, i) => (attempt.checked[i] ? revealedItem(item, key) : hiddenItem(item))) }
  return (
    <Removable id={attempt.id}>
    <div className="mx-auto max-w-6xl">
      <PageHeader title={attempt.title} subtitle={t('{mode} · {n} 題', { mode, n: attempt.items.length })} actions={deletable && <DeleteQuizButton quizId={attempt.id} label={t('不做了，刪除')} note={t('已刪除測驗')} iconOnly />} />
      <QuizPlayer attempt={visible} locale={await localeOf(attempt.ownerId)} aiMarks={(await graderFor(attempt)) !== null} />
    </div>
    </Removable>
  )
}
