import { markOpenAnswers, readHandwrittenAnswers, unreadHandwriting } from '@exam/grading'
import { needsTeacher, type QuizAttempt } from '@exam/quiz'
import { localeOf, services, teacherFor } from '@/server/context'

type Teacher = NonNullable<ReturnType<typeof teacherFor>>

/**
 * Reads handwritten answers into text and saves them, so they can be checked like typing.
 * `only` limits it to some questions. Returns the attempt as saved.
 */
export async function readInk(attempt: QuizAttempt, teacher: Teacher, only?: number[]): Promise<QuizAttempt> {
  const responses = await readHandwrittenAnswers(attempt, teacher.reader, only)
  const { quizzes } = services()
  const now = quizzes.get(attempt.id) ?? attempt
  const saved = { ...now, responses: now.responses.map((r, i) => (unreadHandwriting(r) && responses[i]?.transcribed ? responses[i] : r)) }
  quizzes.save(saved)
  return saved
}

/**
 * Marks a handed-in attempt's unsettled answers in the background, reading handwriting first;
 * the results page shows progress until it is done. Marks the person gave meanwhile are kept.
 */
export function startTeacher(id: string) {
  const { quizzes, gradingCache } = services()
  const attempt = quizzes.get(id)
  const teacher = attempt && teacherFor(attempt.ownerId)
  if (!attempt || !teacher) return
  const unread = attempt.responses.some((r, i) => unreadHandwriting(r) && !attempt.markings[i])
  if (!unread && !attempt.items.some((item, i) => needsTeacher(item, attempt.responses[i] ?? null, attempt.markings[i] ?? null))) return
  quizzes.save({ ...attempt, teacher: { status: 'running', model: teacher.model, error: null } })
  void (async () => {
    const read = unread ? await readInk(attempt, teacher) : attempt
    return markOpenAnswers(read, { grader: teacher.teacher, cache: gradingCache, language: localeOf(attempt.ownerId) })
  })()
    .then(({ markings }) => {
      const now = quizzes.get(id)
      if (!now) return
      quizzes.save({ ...now, markings: now.markings.map((m, i) => m ?? markings[i] ?? null), teacher: { status: 'done', model: teacher.model, error: null } })
    })
    .catch((err: unknown) => {
      const now = quizzes.get(id)
      if (now) quizzes.save({ ...now, teacher: { status: 'failed', model: teacher.model, error: err instanceof Error ? err.message.slice(0, 300) : String(err) } })
    })
}
