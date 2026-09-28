import { defaultPrintedText, type BoundingBox, type DraftExam, type DraftFigure, type Figure, type FigureBlank, type PageImage } from '@exam/core'
import sharp from 'sharp'

export interface CleanFigure {
  /** PNG of the figure with handwriting removed from its blanks. */
  png: Buffer
  width: number
  height: number
  /** Blanks snapped to their printed boxes, relative to the cropped image. */
  blanks: FigureBlank[]
}

export interface CleanOptions {
  /** Space kept around the figure, as a fraction of the page width. Default 0.005. */
  padding?: number
}

interface Rect { x1: number; y1: number; x2: number; y2: number }

/**
 * Crops a figure out of its page image. Model bounding boxes are only roughly right,
 * so each blank is first snapped to the printed box or line around it; coloured
 * handwriting (red, blue) in and just around the blank is then painted over with
 * the paper colour, leaving printed labels such as "7." untouched.
 *
 * Pencil and black pen look like print, so a blank marked `ink: "dark"` is cleared
 * inside its border instead and its `printedText` (or just its label) is typeset back in.
 */
export async function cleanFigure(pageImage: Buffer, figure: Figure, opts: CleanOptions = {}): Promise<CleanFigure> {
  const { data, info } = await sharp(pageImage).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const page = new Page(data, info.width, info.height, info.channels)

  const blanks = figure.blanks.map((b) => ({ ...b, rect: page.snap(page.toRect(b.bbox)) }))
  for (const b of blanks) {
    page.removeInk(b.rect)
    if (b.ink === 'dark') page.clearInside(b.rect)
  }

  const pad = Math.round((opts.padding ?? 0.005) * page.width)
  const crop = [page.toRect(figure.bbox), ...blanks.map((b) => b.rect)].reduce((a, r) => ({
    x1: Math.min(a.x1, r.x1), y1: Math.min(a.y1, r.y1), x2: Math.max(a.x2, r.x2), y2: Math.max(a.y2, r.y2),
  }))
  const left = Math.max(0, crop.x1 - pad), top = Math.max(0, crop.y1 - pad)
  const width = Math.min(page.width, crop.x2 + pad) - left, height = Math.min(page.height, crop.y2 + pad) - top

  const retyped = blanks.filter((b) => b.ink === 'dark')
  const png = await sharp(page.data, { raw: { width: page.width, height: page.height, channels: page.channels as 3 | 4 } })
    .extract({ left, top, width, height })
    .composite(
      retyped.map((b) => ({
        input: Buffer.from(printedTextSvg(b.printedText?.trim() || defaultPrintedText(b.label), b.rect.x2 - b.rect.x1, b.rect.y2 - b.rect.y1, page.borderInset)),
        left: b.rect.x1 - left,
        top: b.rect.y1 - top,
      })),
    )
    .png()
    .toBuffer()
  return {
    png,
    width,
    height,
    blanks: blanks.map(({ rect, ...blank }) => ({
      ...blank,
      bbox: { x: (rect.x1 - left) / width, y: (rect.y1 - top) / height, width: (rect.x2 - rect.x1) / width, height: (rect.y2 - rect.y1) / height },
    })),
  }
}

/**
 * Printed text of a blank as an SVG the size of the box. Each line of `text` fills
 * an equal row; "___" splits a line into pieces spread across the box, so
 * "7. ___ host" puts "7." at the left edge and "host" at the right one.
 */
export function printedTextSvg(text: string, width: number, height: number, inset = 3): string {
  const lines = text.split(/\r?\n/).map((line) => line.split(/_{2,}/).map((part) => part.trim()))
  const innerW = width - 2 * inset, innerH = height - 2 * inset
  const pad = Math.max(2, Math.round(0.04 * innerW))
  const rowH = innerH / lines.length
  // Bold sans glyphs average about 0.6 em; keep a gap for the answer between pieces.
  const widest = Math.max(...lines.map((parts) => parts.join('').length * 0.6 + (parts.length > 1 ? 2 : 0)))
  const size = Math.max(6, Math.min(0.55 * rowH, (innerW - 2 * pad) / Math.max(widest, 1)))
  const escape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const texts = lines.flatMap((parts, row) => {
    const y = inset + rowH * (row + 0.5) + 0.35 * size
    return parts.flatMap((part, k) => {
      if (!part) return []
      const at = parts.length === 1 ? 0 : k / (parts.length - 1)
      const anchor = at === 0 ? 'start' : at === 1 ? 'end' : 'middle'
      const x = inset + pad + at * (innerW - 2 * pad)
      return [`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${escape(part)}</text>`]
    })
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${size.toFixed(1)}" fill="#1a1a1a">${texts.join('')}</g></svg>`
}

/**
 * Crops every figure of a draft exam and records the saved image on the figure.
 * `save` stores one PNG under a stable name (e.g. "q6-1") and returns the path to record.
 */
export async function cropExamFigures(
  exam: DraftExam,
  pages: PageImage[],
  save: (name: string, png: Buffer) => Promise<string>,
): Promise<{ name: string; error: string }[]> {
  const named: [string, DraftFigure][] = [
    ...exam.groups.flatMap((g) => g.figures.map((f, k): [string, DraftFigure] => [`group-${g.id.replace(/\W+/g, '-')}-${k + 1}`, f])),
    ...exam.questions.flatMap((q, n) => q.figures.map((f, k): [string, DraftFigure] => [`q${n + 1}-${k + 1}`, f])),
  ]
  const failures: { name: string; error: string }[] = []
  for (const [name, figure] of named) {
    const page = pages.find((p) => p.pageNumber === figure.pageNumber)
    if (!page) continue
    try {
      const clean = await cleanFigure(page.data, figure)
      figure.image = { file: await save(name, clean.png), width: clean.width, height: clean.height, blanks: clean.blanks }
    } catch (err) {
      failures.push({ name, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return failures
}

/** Pixels whose red or blue channel clearly exceeds the others: pen ink on a grey scan. */
const INK_MARGIN = 15
/** Neutral pixels darker than this (per channel, on average) count as printed lines and text. */
const DARK = 110

class Page {
  constructor(readonly data: Buffer, readonly width: number, readonly height: number, readonly channels: number) {}

  toRect(b: BoundingBox): Rect {
    const clampX = (v: number) => Math.min(this.width - 1, Math.max(0, Math.round(v * this.width)))
    const clampY = (v: number) => Math.min(this.height - 1, Math.max(0, Math.round(v * this.height)))
    return { x1: clampX(b.x), y1: clampY(b.y), x2: clampX(b.x + b.width), y2: clampY(b.y + b.height) }
  }

  private at(x: number, y: number) {
    return (y * this.width + x) * this.channels
  }

  private isInk(i: number) {
    const r = this.data[i]!, g = this.data[i + 1]!, b = this.data[i + 2]!
    return r - Math.max(g, b) > INK_MARGIN || b - Math.max(r, g) > INK_MARGIN
  }

  private isPrint(i: number) {
    return !this.isInk(i) && this.data[i]! + this.data[i + 1]! + this.data[i + 2]! < 3 * DARK
  }

  /** Moves each edge of a rough box to the strongest printed line within reach, if there is one. */
  snap(rough: Rect): Rect {
    const r = { ...rough }
    const reach = Math.max(8, Math.round(0.012 * this.width))
    const inRange = (v: number, max: number) => Math.min(max - 1, Math.max(0, v))
    const strongest = (from: number, to: number, max: number, score: (v: number) => number) => {
      let best = -1, bestScore = 0.5
      for (let v = inRange(from, max); v <= inRange(to, max); v++) {
        const s = score(v)
        if (s > bestScore) [best, bestScore] = [v, s]
      }
      return best
    }
    const row = (y: number) => this.fraction(r.x1, r.x2, (x) => this.isPrint(this.at(x, y)))
    const top = strongest(r.y1 - reach, r.y1 + reach, this.height, row)
    const bottom = strongest(r.y2 - reach, r.y2 + reach, this.height, row)
    if (top >= 0) r.y1 = top
    if (bottom >= 0 && bottom > r.y1) r.y2 = bottom
    const col = (x: number) => this.fraction(r.y1, r.y2, (y) => this.isPrint(this.at(x, y)))
    const left = strongest(r.x1 - reach, r.x1 + reach, this.width, col)
    const right = strongest(r.x2 - reach, r.x2 + reach, this.width, col)
    if (left >= 0) r.x1 = left
    if (right >= 0 && right > r.x1) r.x2 = right
    return r
  }

  private fraction(from: number, to: number, hit: (v: number) => boolean) {
    if (to <= from) return 0
    let n = 0
    for (let v = from; v < to; v++) if (hit(v)) n++
    return n / (to - from)
  }

  /**
   * Paints ink inside the box, with a small halo for anti-aliased edges, and ink
   * strokes that run a little past the box, in the paper colour. Printed pixels stay.
   */
  removeInk(box: Rect) {
    const inset = 3, halo = 2, overrun = Math.round(0.014 * this.width)
    const paper = this.paperColour(box, inset)
    const wipe = new Set<number>()
    for (let y = Math.max(0, box.y1 - overrun); y < Math.min(this.height, box.y2 + overrun); y++) {
      for (let x = Math.max(0, box.x1 - overrun); x < Math.min(this.width, box.x2 + overrun); x++) {
        if (!this.isInk(this.at(x, y))) continue
        const inside = x > box.x1 + inset && x < box.x2 - inset && y > box.y1 + inset && y < box.y2 - inset
        if (!inside) {
          wipe.add(this.at(x, y))
          continue
        }
        for (let dy = -halo; dy <= halo; dy++) {
          for (let dx = -halo; dx <= halo; dx++) {
            const j = this.at(x + dx, y + dy)
            if (!this.isPrint(j)) wipe.add(j)
          }
        }
      }
    }
    for (const i of wipe) paper.forEach((v, c) => (this.data[i + c] = v))
  }

  /** How far inside a snapped box its printed border reaches. */
  get borderInset(): number {
    return Math.max(3, Math.round(0.003 * this.width))
  }

  /** Paints everything inside the box's border in the paper colour: the fallback for pencil and black pen. */
  clearInside(box: Rect) {
    const inset = this.borderInset
    const paper = this.paperColour(box, inset)
    for (let y = box.y1 + inset; y < box.y2 - inset; y++) {
      for (let x = box.x1 + inset; x < box.x2 - inset; x++) {
        const i = this.at(x, y)
        paper.forEach((v, c) => (this.data[i + c] = v))
      }
    }
  }

  /** Median colour of the plain paper inside the box. */
  private paperColour(box: Rect, inset: number): number[] {
    const samples: number[][] = [[], [], []]
    for (let y = box.y1 + inset; y < box.y2 - inset; y += 2) {
      for (let x = box.x1 + inset; x < box.x2 - inset; x += 2) {
        const i = this.at(x, y)
        if (this.isInk(i) || this.isPrint(i)) continue
        for (let c = 0; c < 3; c++) samples[c]!.push(this.data[i + c]!)
      }
    }
    return samples.map((s) => (s.length ? s.sort((a, b) => a - b)[s.length >> 1]! : 255))
  }
}
