import type { DraftExam, DraftQuestion } from './types.ts'

/**
 * Page orders: `order[i]` is the page number now placed at position i + 1, so [2, 1, 3] swaps the
 * first two pages. Every page number of the draft, its boxes, pictures and groups follows.
 */

/** True when `order` holds each page from 1 to `count` exactly once. */
export function isPageOrder(order: readonly number[], count: number): boolean {
  if (order.length !== count) return false
  const seen = new Set(order)
  return seen.size === count && order.every((n) => Number.isInteger(n) && n >= 1 && n <= count)
}

/** True when the order leaves every page where it is. */
export function isSameOrder(order: readonly number[]): boolean {
  return order.every((n, i) => n === i + 1)
}

/** The order that puts the pages back: applied after `order`, every page is where it was. */
export function inverseOrder(order: readonly number[]): number[] {
  const back: number[] = []
  order.forEach((n, i) => (back[n - 1] = i + 1))
  return back
}

/** The new number of each old page number. */
export function pageMap(order: readonly number[]): (pageNumber: number) => number {
  const to = new Map(order.map((n, i) => [n, i + 1]))
  return (n) => to.get(n) ?? n
}

/**
 * The draft with its pages in `order`: every page number moved, and the questions put in the order
 * of their pages (each by the page it starts on; questions on one page keep their order, a question
 * with no box stays after the one before it). `questionOrder[i]` is the old index of question i.
 */
export function reorderDraftPages(draft: DraftExam, order: readonly number[]): { draft: DraftExam; questionOrder: number[] } {
  const to = pageMap(order)
  const figures = <F extends { pageNumber: number }>(list: F[]) => list.map((f) => ({ ...f, pageNumber: to(f.pageNumber) }))
  const questions: DraftQuestion[] = draft.questions.map((q) => ({
    ...q,
    figures: figures(q.figures),
    locations: q.locations.map((l) => ({ ...l, pageNumber: to(l.pageNumber) })),
  }))
  // where each question sits: the page it starts on, or that of the question before it
  let last = 0
  const at = questions.map((q) => (last = q.locations[0]?.pageNumber ?? last))
  const questionOrder = questions.map((_, i) => i).sort((a, b) => at[a]! - at[b]! || a - b)
  const byPage = <T extends { pageNumber: number }>(list: T[]) => list.map((x, i) => [x, i] as const).sort(([a, i], [b, j]) => a.pageNumber - b.pageNumber || i - j).map(([x]) => x)
  return {
    draft: {
      ...draft,
      groups: byPage(draft.groups.map((g) => ({ ...g, pageNumber: to(g.pageNumber), figures: figures(g.figures) }))),
      questions: questionOrder.map((i) => questions[i]!),
      pages: byPage(draft.pages.map((p) => ({ ...p, pageNumber: to(p.pageNumber) }))),
    },
    questionOrder,
  }
}

/**
 * The order pages uploaded at random belong in, told by the question numbers read on them: each
 * page's numbers run from where the page before stopped. Null when the numbers do not tell (a page
 * without numbered questions, numbering that starts over in a later section) or the order is right.
 */
export function guessPageOrder(pages: readonly (readonly string[])[]): number[] | null {
  if (pages.length < 2) return null
  const ranges = pages.map((numbers, i) => {
    const values = numbers.map((s) => /^\s*(\d+)/.exec(s)?.[1]).filter((v): v is string => v !== undefined).map(Number)
    return values.length ? { page: i + 1, low: Math.min(...values), high: Math.max(...values) } : null
  })
  if (ranges.some((r) => r === null)) return null
  const sorted = (ranges as { page: number; low: number; high: number }[]).sort((a, b) => a.low - b.low || a.high - b.high)
  // a question that runs onto the next page is numbered on both
  if (sorted.some((r, i) => i > 0 && sorted[i - 1]!.high > r.low)) return null
  const order = sorted.map((r) => r.page)
  return isSameOrder(order) ? null : order
}
