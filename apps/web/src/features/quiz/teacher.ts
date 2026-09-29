import { markOpenAnswers } from '@exam/grading'
import { needsTeacher } from '@exam/quiz'
import { localeOf, services, teacherFor } from '@/server/context'

/**
 * Marks a handed-in attempt's unsettled answers in the background; the results page shows
 * progress until it is done. Marks the person gave meanwhile are kept.
 */
export function startTeacher(id: string) {
  const { quizzes, gradingCache } = services()
  const attempt = quizzes.get(id)
  const teacher = attempt && teacherFor(attempt.ownerId)
  if (!attempt || !teacher) return
  if (!attempt.items.some((item, i) => needsTeacher(item, attempt.responses[i] ?? null, attempt.markings[i] ?? null))) return
  quizzes.save({ ...attempt, teacher: { status: 'running', model: teacher.model, error: null } })
  void markOpenAnswers(attempt, { grader: teacher.teacher, cache: gradingCache, language: localeOf(attempt.ownerId) })
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
