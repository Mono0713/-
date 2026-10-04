import type { DraftQuestion } from './types.ts'

/**
 * A matching question answered by picking one option per item: it has at least two options to
 * pick from and each answer in its key is a single option label (a key such as "A, B" is typed).
 */
export function isPickMatching(q: Pick<DraftQuestion, 'type' | 'options' | 'answer'>): boolean {
  if (q.type !== 'matching' || q.options.length < 2) return false
  const labels = new Set(q.options.map((o) => o.label.trim().toLowerCase()))
  return q.answer.values.every((v) => !v.trim() || labels.has(v.trim().toLowerCase()))
}

/**
 * How many items a matching question asks to match: one per answer in the key, or, without
 * a key, one per numbered line in the stem ("1. 光合作用", "(2) 呼吸作用"). At least one.
 */
export function matchingItemCount(q: Pick<DraftQuestion, 'stem' | 'answer'>): number {
  const numbered = q.stem.split('\n').filter((line) => /^\s*(?:[-*]\s*)?[(（]?\d{1,2}\s*[).、．）:]/.test(line)).length
  return Math.max(1, q.answer.values.length, numbered)
}
