import { summarize, type QuizAttempt, type QuizSource } from '@exam/quiz'
import type { Member } from './types.ts'

/** How one student did on an assignment: the attempt that counts is the last one handed in, else the one under way. */
export interface StudentResult {
  userId: string
  /** Empty for a student who has left the class: the class no longer holds their name. */
  name: string
  /** Left the class (or was removed) after starting it; their work still counts. */
  left: boolean
  /** Attempts started. */
  tries: number
  counted: {
    attemptId: string
    handedIn: boolean
    score: number
    max: number
    /** Answers still waiting for a mark. */
    pending: number
    startedAt: string
    finishedAt: string | null
  } | null
}

export interface QuestionStat {
  questionId: string
  number: string
  /** Share of the points earned on it, over the handed-in attempts; null before anyone handed in. */
  rate: number | null
  /** Handed-in attempts that answered it. */
  answered: number
}

export interface AssignmentStats {
  students: StudentResult[]
  questions: QuestionStat[]
  handedIn: number
  /** The handed-in attempts that count, one per student: what the charts and the export read. */
  counted: QuizAttempt[]
  /** Average share of the points over the handed-in attempts; null before anyone handed in. */
  average: number | null
  /** Answers the AI marked, and how many of those the teacher changed. */
  aiMarked: number
  overridden: number
}

/**
 * Results of an assignment for its teacher. `attempts` are the students' attempts (not
 * previews), any order. Questions are matched by id, since each attempt may be shuffled.
 */
export function assignmentStats(sources: QuizSource[], members: Member[], attempts: QuizAttempt[]): AssignmentStats {
  const students = members.filter((m) => m.role === 'student')
  const byStudent = new Map<string, QuizAttempt[]>()
  for (const a of attempts) byStudent.set(a.ownerId, [...(byStudent.get(a.ownerId) ?? []), a])

  // Students who left keep their handed-in work with the teacher, so they keep a row.
  const inClass = new Set(members.map((m) => m.userId))
  const departed = [...byStudent.keys()].filter((id) => !inClass.has(id)).map((userId) => ({ userId, name: '', left: true }))
  const counted: QuizAttempt[] = []
  const results = [...students.map((m) => ({ userId: m.userId, name: m.name, left: false })), ...departed].map((m): StudentResult => {
    const mine = (byStudent.get(m.userId) ?? []).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    const done = mine.filter((a) => a.finishedAt)
    const pick = done.at(-1) ?? mine.at(-1)
    if (!pick) return { ...m, tries: 0, counted: null }
    const s = summarize(pick)
    if (pick.finishedAt) counted.push(pick)
    return {
      ...m,
      tries: mine.length,
      counted: { attemptId: pick.id, handedIn: Boolean(pick.finishedAt), score: s.score, max: s.max, pending: s.pending, startedAt: pick.startedAt, finishedAt: pick.finishedAt },
    }
  })

  const earned = new Map<string, { score: number; max: number; answered: number }>()
  let aiMarked = 0
  let overridden = 0
  let shares = 0
  for (const a of counted) {
    const s = summarize(a)
    if (s.max) shares += s.score / s.max
    a.items.forEach((item, i) => {
      const g = s.grades[i]!
      const e = earned.get(item.questionId) ?? { score: 0, max: 0, answered: 0 }
      earned.set(item.questionId, { score: e.score + g.score, max: e.max + g.max, answered: e.answered + (g.status === 'unanswered' ? 0 : 1) })
      const m = a.markings[i]
      const fromAi = m?.by === 'ai' || m?.replaced?.by === 'ai'
      if (fromAi) aiMarked++
      if (m?.by === 'teacher' && m.replaced?.by === 'ai' && m.replaced.credit !== m.credit) overridden++
    })
  }

  return {
    students: results,
    questions: sources.map((src) => {
      const e = earned.get(src.questionId)
      return { questionId: src.questionId, number: src.question.number, rate: e && e.max ? e.score / e.max : null, answered: e?.answered ?? 0 }
    }),
    handedIn: counted.length,
    counted,
    average: counted.length ? shares / counted.length : null,
    aiMarked,
    overridden,
  }
}
