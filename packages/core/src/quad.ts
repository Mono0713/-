import type { BoundingBox } from './schema.ts'
import type { DraftExam } from './types.ts'

/** A point as a fraction of an image's width and height. */
export interface Point {
  x: number
  y: number
}

/**
 * Where the paper is in a photographed page: its four corners, top-left, top-right, bottom-right,
 * bottom-left, as fractions of the uncropped image. The page shown is this area flattened into a rectangle.
 */
export type Quad = [Point, Point, Point, Point]

/** The whole image: nothing cut off. */
export const FULL_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
]

type Matrix = [number, number, number, number, number, number, number, number, number]

/** The perspective map taking the unit square (0,0)-(1,1) onto `q`, corner for corner. */
export function squareToQuad(q: Quad): Matrix {
  const [p0, p1, p2, p3] = q
  const dx1 = p1.x - p2.x
  const dx2 = p3.x - p2.x
  const dy1 = p1.y - p2.y
  const dy2 = p3.y - p2.y
  const sx = p0.x - p1.x + p2.x - p3.x
  const sy = p0.y - p1.y + p2.y - p3.y
  const det = dx1 * dy2 - dx2 * dy1
  const g = det ? (sx * dy2 - dx2 * sy) / det : 0
  const h = det ? (dx1 * sy - sx * dy1) / det : 0
  return [p1.x - p0.x + g * p1.x, p3.x - p0.x + h * p3.x, p0.x, p1.y - p0.y + g * p1.y, p3.y - p0.y + h * p3.y, p0.y, g, h, 1]
}

export function invert(m: Matrix): Matrix {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h
  const B = -(d * i - f * g)
  const C = d * h - e * g
  const det = a * A + b * B + c * C || 1e-12
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det]
}

export function mapPoint(m: Matrix, x: number, y: number): Point {
  const w = m[6] * x + m[7] * y + m[8] || 1e-12
  return { x: (m[0] * x + m[1] * y + m[2]) / w, y: (m[3] * x + m[4] * y + m[5]) / w }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/**
 * A box on a page cut out by `from`, moved onto the page cut out by `to` (null: the whole image):
 * the smallest box around where its corners and edge middles land, kept on the page.
 */
export function remapBox(box: BoundingBox, from: Quad | null, to: Quad | null): BoundingBox {
  const out = squareToQuad(from ?? FULL_QUAD)
  const back = invert(squareToQuad(to ?? FULL_QUAD))
  const xs: number[] = []
  const ys: number[] = []
  for (const [u, v] of [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]] as const) {
    const raw = mapPoint(out, box.x + u * box.width, box.y + v * box.height)
    const p = mapPoint(back, raw.x, raw.y)
    xs.push(clamp01(p.x))
    ys.push(clamp01(p.y))
  }
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

/** Every `bbox` inside `value` changed by `move`, except inside `image` (a cropped picture's own boxes). */
export function remapBoxes<T>(value: T, move: (box: BoundingBox) => BoundingBox): T {
  if (Array.isArray(value)) return value.map((v) => remapBoxes(v, move)) as T
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    if (k === 'image') out[k] = v
    else if (k === 'bbox' && v && typeof v === 'object' && 'width' in v) out[k] = move(v as BoundingBox)
    else out[k] = remapBoxes(v, move)
  }
  return out as T
}

/** True when the corners go round without crossing and the area is not a sliver. */
export function isUsableQuad(q: Quad): boolean {
  let sign = 0
  for (let i = 0; i < 4; i++) {
    const a = q[i]!
    const b = q[(i + 1) % 4]!
    const c = q[(i + 2) % 4]!
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-6) return false
    const s = Math.sign(cross)
    if (sign && s !== sign) return false
    sign = s
  }
  return quadArea(q) > 0.02
}

export function quadArea(q: Quad): number {
  let a = 0
  for (let i = 0; i < 4; i++) a += q[i]!.x * q[(i + 1) % 4]!.y - q[(i + 1) % 4]!.x * q[i]!.y
  return Math.abs(a) / 2
}

/** True when `q` is the whole image, give or take a hair. */
export function isFullQuad(q: Quad | null): boolean {
  return !q || q.every((p, i) => Math.abs(p.x - FULL_QUAD[i]!.x) < 0.002 && Math.abs(p.y - FULL_QUAD[i]!.y) < 0.002)
}

/** The draft with every box on page `pageNumber` (questions' boxes, pictures and their blanks) changed by `move`. */
export function remapDraftPage(draft: DraftExam, pageNumber: number, move: (box: BoundingBox) => BoundingBox): DraftExam {
  const figures = <F extends { pageNumber: number }>(list: F[]) => list.map((f) => (f.pageNumber === pageNumber ? remapBoxes(f, move) : f))
  return {
    ...draft,
    groups: draft.groups.map((g) => ({ ...g, figures: figures(g.figures) })),
    questions: draft.questions.map((q) => ({
      ...q,
      figures: figures(q.figures),
      locations: q.locations.map((l) => (l.pageNumber === pageNumber ? { ...l, bbox: move(l.bbox) } : l)),
    })),
  }
}
