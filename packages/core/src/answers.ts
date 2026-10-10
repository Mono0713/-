import type { DraftQuestion } from './types.ts'

/** Question types the AI can write an answer for; practice and free writing have none to give. */
export const SOLVABLE: ReadonlySet<DraftQuestion['type']> = new Set([
  'single_choice', 'multiple_choice', 'true_false', 'fill_in_blank', 'short_answer', 'essay', 'calculation', 'matching', 'drawing', 'other',
])

/** A question without a key that has an answer to work out. */
export const needsAnswer = (q: Pick<DraftQuestion, 'type' | 'answer'>) => SOLVABLE.has(q.type) && !q.answer.values.some((v) => v.trim())

/** A question with a key but no worked explanation, one the AI can write. */
export const needsExplanation = (q: Pick<DraftQuestion, 'type' | 'answer' | 'explanation'>) =>
  SOLVABLE.has(q.type) && q.answer.values.some((v) => v.trim()) && !q.explanation?.trim()
