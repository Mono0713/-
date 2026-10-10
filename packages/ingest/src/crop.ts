import sharp from 'sharp'
import { quadArea, squareToQuad, type Point, type Quad } from '@exam/core'

// Pages are looked for on a small copy: fast, and paper edges are large shapes.
const SIZE = 320

/**
 * Finds the sheet of paper in a photo, on the device's own server (no AI): paper is brighter and
 * less colourful than what it lies on, so the largest such area is taken and the four-cornered
 * shape that best fits around it is returned. Null when there is no clear sheet, or the sheet
 * already fills the image (a scan, a page from a PDF), so nothing would be cut off.
 */
export async function findPage(input: Buffer): Promise<Quad | null> {
  const { data, info } = await sharp(input, { failOn: 'none' })
    .resize({ width: SIZE, height: SIZE, fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  const n = w * h
  const ch = info.channels
  // paper-ness: bright and grey
  const score = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const r = data[i * ch]!
    const g = data[i * ch + 1]!
    const b = data[i * ch + 2]!
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    score[i] = Math.max(0, Math.min(255, Math.round((r + g + b) / 3 - 1.2 * chroma)))
  }
  const cut = otsu(score)
  // one pixel shaved off every bright area, so thin bright bridges to the background break
  const bright = new Uint8Array(n)
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      bright[i] = score[i]! > cut && score[i - 1]! > cut && score[i + 1]! > cut && score[i - w]! > cut && score[i + w]! > cut ? 1 : 0
    }
  const sheet = largestArea(bright, w, h)
  if (!sheet || sheet.size < n * 0.15) return null

  // the sheet's outline: leftmost and rightmost pixel of each row, around which the hull goes
  const points: Point[] = []
  for (let y = 0; y < h; y++) {
    let left = -1
    let right = -1
    for (let x = 0; x < w; x++)
      if (sheet.mask[y * w + x]) {
        if (left < 0) left = x
        right = x
      }
    if (left >= 0) points.push({ x: left, y }, { x: right + 1, y }, { x: left, y: y + 1 }, { x: right + 1, y: y + 1 })
  }
  let hull = convexHull(points)
  if (hull.length > 36) hull = hull.filter((_, i) => i % Math.ceil(hull.length / 36) === 0)
  if (hull.length < 4) return null
  const corners = biggestQuad(hull)
  const quad = order(corners.map((p) => ({ x: clamp01((p.x + (p.x > w / 2 ? 1 : -1)) / w), y: clamp01((p.y + (p.y > h / 2 ? 1 : -1)) / h) }))) // the shaved pixel back
  const area = quadArea(quad)
  // the paper must be most of what was found, and must leave something worth cutting off
  if (area * n < sheet.size * 0.85 || area > 0.93) return null
  return quad
}

/**
 * The area inside `quad` flattened into a rectangle as wide and tall as its edges are long on
 * average, longest edge at most `maxEdge`, as PNG.
 */
export async function flattenPage(input: Buffer, quad: Quad, maxEdge = 2000): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input, { failOn: 'none' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: ch } = info
  const px = quad.map((p) => ({ x: p.x * w, y: p.y * h })) as Quad
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
  let outW = (dist(px[0], px[1]) + dist(px[3], px[2])) / 2
  let outH = (dist(px[0], px[3]) + dist(px[1], px[2])) / 2
  const scale = Math.min(1, maxEdge / Math.max(outW, outH))
  outW = Math.max(1, Math.round(outW * scale))
  outH = Math.max(1, Math.round(outH * scale))
  const m = squareToQuad(px)
  const out = Buffer.alloc(outW * outH * ch)
  for (let y = 0; y < outH; y++) {
    const v = (y + 0.5) / outH
    for (let x = 0; x < outW; x++) {
      const u = (x + 0.5) / outW
      const d = m[6] * u + m[7] * v + 1
      const sx = Math.min(w - 1, Math.max(0, (m[0] * u + m[1] * v + m[2]) / d - 0.5))
      const sy = Math.min(h - 1, Math.max(0, (m[3] * u + m[4] * v + m[5]) / d - 0.5))
      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      const x1 = Math.min(w - 1, x0 + 1)
      const y1 = Math.min(h - 1, y0 + 1)
      const fx = sx - x0
      const fy = sy - y0
      const o = (y * outW + x) * ch
      for (let c = 0; c < ch; c++) {
        const top = data[(y0 * w + x0) * ch + c]! * (1 - fx) + data[(y0 * w + x1) * ch + c]! * fx
        const bottom = data[(y1 * w + x0) * ch + c]! * (1 - fx) + data[(y1 * w + x1) * ch + c]! * fx
        out[o + c] = Math.round(top * (1 - fy) + bottom * fy)
      }
    }
  }
  const png = await sharp(out, { raw: { width: outW, height: outH, channels: ch } }).png().toBuffer()
  return { data: png, width: outW, height: outH }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** The brightness that best splits the image into two groups (Otsu). */
function otsu(values: Uint8Array): number {
  const hist = new Array<number>(256).fill(0)
  for (const v of values) hist[v]!++
  const total = values.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]!
  let sumB = 0
  let wB = 0
  let best = 0
  let cut = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!
    if (!wB) continue
    const wF = total - wB
    if (!wF) break
    sumB += t * hist[t]!
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2
    if (between > best) {
      best = between
      cut = t
    }
  }
  return cut
}

/** The largest connected area of set pixels. */
function largestArea(mask: Uint8Array, w: number, h: number): { mask: Uint8Array; size: number } | null {
  const label = new Int32Array(w * h)
  const stack = new Int32Array(w * h)
  let best = 0
  let bestSize = 0
  let next = 0
  for (let start = 0; start < w * h; start++) {
    if (!mask[start] || label[start]) continue
    next++
    let size = 0
    let top = 0
    stack[top++] = start
    label[start] = next
    while (top) {
      const i = stack[--top]!
      size++
      const x = i % w
      const near = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]
      for (const j of near)
        if (j >= 0 && j < w * h && mask[j] && !label[j]) {
          label[j] = next
          stack[top++] = j
        }
    }
    if (size > bestSize) {
      bestSize = size
      best = next
    }
  }
  if (!best) return null
  const out = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) out[i] = label[i] === best ? 1 : 0
  return { mask: out, size: bestSize }
}

function convexHull(points: Point[]): Point[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Point[] = []
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop()
    lower.push(q)
  }
  const upper: Point[] = []
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop()
    upper.push(q)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/** The four hull points enclosing the most area (hull points keep their order, so the shape never crosses). */
function biggestQuad(hull: Point[]): Point[] {
  const n = hull.length
  const tri = (a: Point, b: Point, c: Point) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2
  let best = -1
  let pick = [0, 1, 2, 3]
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) {
          const area = tri(hull[a]!, hull[b]!, hull[c]!) + tri(hull[a]!, hull[c]!, hull[d]!)
          if (area > best) {
            best = area
            pick = [a, b, c, d]
          }
        }
  return pick.map((i) => hull[i]!)
}

/** Corners in order top-left, top-right, bottom-right, bottom-left. */
function order(points: Point[]): Quad {
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length
  const round = [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx))
  // clockwise on screen from the one nearest the top-left
  const first = round.reduce((bi, p, i) => (p.x + p.y < round[bi]!.x + round[bi]!.y ? i : bi), 0)
  return [0, 1, 2, 3].map((k) => round[(first + k) % 4]!) as Quad
}
