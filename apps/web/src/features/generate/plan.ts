import type { QuestionType } from '@exam/core'
import type { Difficulty, ExamPlan } from '@exam/grading'

/** Question types AI 出題 offers, in the order the exam prints them, with the count each starts at. */
export const OFFERED: { type: QuestionType; count: number }[] = [
  { type: 'single_choice', count: 10 },
  { type: 'multiple_choice', count: 0 },
  { type: 'true_false', count: 0 },
  { type: 'fill_in_blank', count: 5 },
  { type: 'matching', count: 0 },
  { type: 'short_answer', count: 3 },
  { type: 'calculation', count: 0 },
  { type: 'essay', count: 0 },
  { type: 'composition', count: 0 },
]

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']

/** Most questions of one type. */
export const MAX_PER_TYPE = 30

/** The form's choices as the plan the AI writes from; counts out of range are clamped, unknown types dropped. */
export function readPlan(form: FormData): ExamPlan {
  const difficulty = String(form.get('difficulty'))
  const text = (name: string) => String(form.get(name) ?? '').trim().slice(0, 500) || null
  return {
    types: OFFERED.map(({ type }) => ({ type, count: Math.min(MAX_PER_TYPE, Math.max(0, Math.round(Number(form.get(`count.${type}`)) || 0))) })).filter((x) => x.count > 0),
    difficulty: (DIFFICULTIES as readonly string[]).includes(difficulty) ? (difficulty as Difficulty) : 'medium',
    groups: form.get('groups') === 'on',
    figures: form.get('figures') === 'on',
    notes: text('notes'),
    title: text('title')?.slice(0, 80) ?? null,
  }
}
