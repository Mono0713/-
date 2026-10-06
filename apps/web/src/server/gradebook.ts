import { assignmentStats, type Assignment, type AssignmentStats, type Member } from '@exam/classes'
import type { QuizAttempt } from '@exam/quiz'
import { services } from './context'

export interface Gradebook {
  members: Member[]
  /** Oldest first, as a term goes. */
  assignments: { assignment: Assignment; stats: AssignmentStats; attempts: QuizAttempt[] }[]
}

/** Every assignment of a class with its results, for the export, the charts and a student's own page. Callers check who may see it. */
export async function gradebook(classId: string, only?: string): Promise<Gradebook> {
  const { classes, quizzes } = services()
  const [members, all] = await Promise.all([classes.members(classId), classes.assignments(classId)])
  const chosen = all.filter((a) => !only || a.id === only).reverse()
  const assignments = await Promise.all(
    chosen.map(async (assignment) => {
      const tries = (await classes.attempts(assignment.id)).filter((x) => !x.preview)
      const attempts = (await Promise.all(tries.map((x) => quizzes.get(x.attemptId)))).filter((x) => x !== null)
      return { assignment, stats: assignmentStats(assignment.sources, members, attempts), attempts }
    }),
  )
  return { members, assignments }
}
