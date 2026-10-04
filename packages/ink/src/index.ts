import { getStroke } from 'perfect-freehand'

export * from './paper.ts'

/**
 * Handwriting as data: strokes of points, measured in page widths so the same ink draws
 * at any size (x from 0 to 1, y from 0 to `height`). Pressure is 0 to 1; 0.5 when unknown.
 */
export type InkPoint = [x: number, y: number, pressure: number]

export interface Stroke {
  points: InkPoint[]
  color: string
  /** Pen width in page widths (0.004 is a fine pen on a 1000px page). */
  size: number
}

export interface InkDoc {
  strokes: Stroke[]
  /** Page height in page widths. */
  height: number
}

export const emptyInk = (height = 0.5): InkDoc => ({ strokes: [], height })

export const isEmptyInk = (doc: InkDoc | null | undefined): boolean => !doc || doc.strokes.length === 0

/** Rounds points and drops ones too close to the last, to keep saved ink small. */
export function compactStroke(stroke: Stroke): Stroke {
  const out: InkPoint[] = []
  for (const [x, y, p] of stroke.points) {
    const last = out.at(-1)
    if (last && Math.hypot(last[0] - x, last[1] - y) < 0.0008) continue
    out.push([round(x), round(y), Math.round(p * 100) / 100])
  }
  return { ...stroke, points: out }
}

const round = (n: number) => Math.round(n * 10000) / 10000

/** The outline of a stroke as an SVG path, `width` pixels per page width; pressure makes it thicker. */
export function strokePath(stroke: Stroke, width: number): string {
  const pts = stroke.points.map(([x, y, p]) => [x * width, y * width, p])
  const outline = getStroke(pts, {
    size: stroke.size * width,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: stroke.points.every(([, , p]) => p === 0.5),
    last: true,
  })
  if (!outline.length) return ''
  const [first, ...rest] = outline
  // Quadratic curves through the midpoints give a smooth closed shape.
  let d = `M${f(first![0])} ${f(first![1])}Q`
  rest.forEach(([x, y], i) => {
    const [nx, ny] = outline[(i + 2) % outline.length]!
    d += `${f(x!)} ${f(y!)} ${f((x! + nx!) / 2)} ${f((y! + ny!) / 2)} `
  })
  return `${d}Z`
}

const f = (n: number) => n.toFixed(1)

/** The whole page as an SVG image, e.g. to send handwriting to a model or show it read-only; `underlay` (SVG) is drawn under the ink. */
export function inkToSvg(doc: InkDoc, width = 1000, background = '#ffffff', underlay = ''): string {
  const height = Math.max(1, Math.round(doc.height * width))
  const paths = doc.strokes.map((s) => `<path d="${strokePath(s, width)}" fill="${escape(s.color)}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="${escape(background)}"/>${underlay}${paths}</svg>`
}

const escape = (s: string) => s.replace(/[^#\w(),. ]/g, '')

/** Whether a point (in page widths) touches a stroke, for the stroke eraser. */
export function hitsStroke(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const pts = stroke.points
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i]!
    const [bx, by] = pts[i + 1] ?? pts[i]!
    const dx = bx - ax
    const dy = by - ay
    const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0
    if (Math.hypot(ax + t * dx - x, ay + t * dy - y) <= radius + stroke.size / 2) return true
  }
  return false
}
