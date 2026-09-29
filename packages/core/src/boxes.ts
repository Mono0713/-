import type { DraftQuestion } from './types.ts'

/**
 * Models often draw a question's box a little too far down, over the start of the next question.
 * This trims each box so it ends where the next question in the same column begins.
 * Boxes side by side (two columns, or two pages in one photo) are left alone.
 */
export function untangleBoxes<Q extends Pick<DraftQuestion, 'locations'>>(questions: Q[]): Q[] {
  const all = questions.flatMap((q, qi) => q.locations.map((l, li) => ({ qi, li, page: l.pageNumber, box: l.bbox })))
  const bottoms = new Map<string, number>()
  for (const a of all) {
    const top = a.box.y
    let bottom = a.box.y + a.box.height
    for (const b of all) {
      if (b === a || b.page !== a.page || b.qi === a.qi || b.box.y <= top + 0.005) continue
      const overlap = Math.min(a.box.x + a.box.width, b.box.x + b.box.width) - Math.max(a.box.x, b.box.x)
      // Same column: they share most of the narrower one's width.
      if (overlap < 0.5 * Math.min(a.box.width, b.box.width)) continue
      if (b.box.y < bottom) bottom = b.box.y
    }
    if (bottom < a.box.y + a.box.height) bottoms.set(`${a.qi}:${a.li}`, Math.max(bottom - 0.003, top + 0.01))
  }
  if (!bottoms.size) return questions
  return questions.map((q, qi) => {
    if (!q.locations.some((_, li) => bottoms.has(`${qi}:${li}`))) return q
    return {
      ...q,
      locations: q.locations.map((l, li) => {
        const bottom = bottoms.get(`${qi}:${li}`)
        return bottom === undefined ? l : { ...l, bbox: { ...l.bbox, height: bottom - l.bbox.y } }
      }),
    }
  })
}
