import type { DraftExam, PageImage } from '@exam/core'
import sharp from 'sharp'

/** Farthest a box is moved, as a share of the page height: further than this, the reading is trusted. */
const MAX_SHIFT = 0.04
/** A pixel this dark counts as ink. */
const INK = 150

/**
 * Models place question boxes about half a line too high. This moves each box the model drew
 * (never one placed by hand) so its top sits on the start of the question's first text line:
 * when the top lands in a gap or in the lower half of the line above, the box moves down to the
 * next line; when it cuts into the top of a line, it moves up to that line. Only `pages` are touched.
 */
export async function snapBoxesToText(exam: DraftExam, pages: PageImage[]): Promise<void> {
  for (const page of pages) {
    const locations = exam.questions.flatMap((q) => q.locations).filter((l) => l.pageNumber === page.pageNumber && !l.manual)
    if (!locations.length) continue
    const { data, info } = await sharp(page.data).greyscale().raw().toBuffer({ resolveWithObject: true })
    for (const l of locations) {
      const dy = lineShift(data, info.width, info.height, l.bbox)
      if (dy !== 0) l.bbox = { ...l.bbox, y: Math.max(0, Math.min(1 - l.bbox.height, l.bbox.y + dy)) }
    }
  }
}

/** The vertical move, as a share of the page height, that puts the box top on its first line. */
export function lineShift(grey: Uint8Array | Buffer, width: number, height: number, box: { x: number; y: number; width: number; height: number }): number {
  const x0 = Math.max(0, Math.floor(box.x * width))
  const x1 = Math.min(width, Math.ceil((box.x + box.width) * width))
  const top = Math.round(box.y * height)
  const reach = Math.round(MAX_SHIFT * height)
  const from = Math.max(0, top - reach)
  const to = Math.min(height, top + reach)
  if (x1 - x0 < 10 || to - from < 3) return 0
  // A row is text when a few of its pixels are ink (specks and scan noise are ignored).
  const need = Math.max(2, Math.round((x1 - x0) * 0.004))
  const inked: boolean[] = []
  for (let y = from; y < to; y++) {
    let n = 0
    const row = y * width
    for (let x = x0; x < x1 && n < need; x++) if (grey[row + x]! < INK) n++
    inked.push(n >= need)
  }
  // Runs of text rows, joining gaps of a pixel or two inside a line.
  const runs: [number, number][] = []
  inked.forEach((on, i) => {
    if (!on) return
    const last = runs.at(-1)
    if (last && i - last[1] <= 2) last[1] = i
    else runs.push([i, i])
  })
  const at = top - from
  const inside = runs.find(([s, e]) => s <= at && at <= e)
  let target: number | undefined
  // A block much taller than a line (a table with side borders, a figure) has no lines to snap to.
  const tallest = Math.round(height * 0.025)
  if (inside && inside[1] - inside[0] > tallest) return 0
  if (inside) {
    // in the upper half of a line: the box cut into its own first line
    if (at - inside[0] <= (inside[1] - inside[0]) / 2) target = inside[0]
    else target = runs.find(([s]) => s > inside[1])?.[0]
  } else {
    target = runs.find(([s]) => s > at)?.[0]
  }
  if (target === undefined) return 0
  // a little air above the line, as a person would draw it
  const pad = Math.round(height * 0.004)
  const dy = target - pad - at
  return Math.abs(dy) <= 1 ? 0 : dy / height
}
