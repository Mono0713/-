import { summarize, type GradeStatus, type QuizAttempt, type QuizSource } from '@exam/quiz'
import type { StudentResult } from './stats.ts'

/** One student's result on one question, found by question id since each attempt may be shuffled. */
export interface GridCell {
  status: GradeStatus
  score: number
  max: number
  /** Where the question sits in that student's attempt. */
  index: number
}

export interface GridRow {
  userId: string
  name: string
  left: boolean
  /** The handed-in attempt shown; null when the student has not handed one in. */
  attemptId: string | null
  /** One per question of the assignment, in its order; null when not handed in. */
  cells: (GridCell | null)[]
}

/** Every student × every question: right, partly right, wrong, blank or waiting for a mark. */
export function answerGrid(sources: QuizSource[], students: StudentResult[], counted: QuizAttempt[]): GridRow[] {
  const byId = new Map(counted.map((a) => [a.id, a]))
  return students.map((r) => {
    const attempt = r.counted?.handedIn ? byId.get(r.counted.attemptId) : undefined
    if (!attempt) return { userId: r.userId, name: r.name, left: r.left, attemptId: null, cells: sources.map(() => null) }
    const grades = summarize(attempt).grades
    const at = new Map(attempt.items.map((item, i) => [item.questionId, i]))
    return {
      userId: r.userId,
      name: r.name,
      left: r.left,
      attemptId: attempt.id,
      cells: sources.map((s) => {
        const i = at.get(s.questionId)
        const g = i === undefined ? undefined : grades[i]
        return g && i !== undefined ? { status: g.status, score: g.score, max: g.max, index: i } : null
      }),
    }
  })
}

/** The questions of a handed-in attempt that lost points (wrong, partly right or left blank), for practising them again. */
export function missedQuestions(attempt: QuizAttempt): string[] {
  const grades = summarize(attempt).grades
  return attempt.items.filter((_, i) => ['wrong', 'partial', 'unanswered'].includes(grades[i]!.status)).map((item) => item.questionId)
}
