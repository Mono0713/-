import type { DraftQuestion } from './types.ts'

/**
 * A question answered by picking option labels into its blanks or items instead of typing:
 * a matching question (配合題), or a fill-in whose blanks take labels from a printed list
 * ("fill the blanks with (A) to (L)", labels may repeat). It has at least two options and each
 * answer in its key is a single option label (a key such as "A, B" is typed). A key may be empty: the quiz hides it until the answer
 * is shown, and a fill-in that prints a list of options is picked from it either way.
 */
export function isPickAnswer(q: Pick<DraftQuestion, 'type' | 'options' | 'answer'>): boolean {
  if ((q.type !== 'matching' && q.type !== 'fill_in_blank') || q.options.length < 2) return false
  const labels = new Set(q.options.map((o) => o.label.trim().toLowerCase()))
  return q.answer.values.every((v) => !v.trim() || labels.has(v.trim().toLowerCase()))
}

/**
 * How many items a matching question asks to match: one per answer in the key, or, without
 * a key, one per numbered line in the stem ("1. 光合作用", "(2) 呼吸作用"). At least one.
 * A fill-in counts its answers or the blank lines (___) in its stem.
 */
export function matchingItemCount(q: Pick<DraftQuestion, 'stem' | 'answer'> & { type?: DraftQuestion['type'] }): number {
  if (q.type === 'fill_in_blank') return Math.max(1, q.answer.values.length, q.stem.match(/_{3,}/g)?.length ?? 0)
  const numbered = q.stem.split('\n').filter((line) => /^\s*(?:[-*]\s*)?[(（]?\d{1,2}\s*[).、．）:]/.test(line)).length
  return Math.max(1, q.answer.values.length, numbered)
}
