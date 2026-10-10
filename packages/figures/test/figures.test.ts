import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { cleanFigure, printedTextSvg } from '../src/index.ts'

const W = 400, H = 300

/** White page with a printed box at (100,100)-(300,160), a printed "7." block and red handwriting in it. */
async function pageImage() {
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#f4f4f2"/>
    <rect x="100" y="100" width="200" height="60" fill="none" stroke="#111" stroke-width="3"/>
    <rect x="110" y="120" width="16" height="20" fill="#222"/>
    <path d="M180 145 L200 110 L220 145 M190 130 L210 130" stroke="#d04050" stroke-width="5" fill="none"/>
    <path d="M230 150 L240 185" stroke="#d04050" stroke-width="5"/>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

/** Same box, with a pencil-grey answer written in it. */
async function pencilPage() {
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#f4f4f2"/>
    <rect x="100" y="100" width="200" height="60" fill="none" stroke="#111" stroke-width="3"/>
    <rect x="110" y="120" width="16" height="20" fill="#222"/>
    <path d="M180 145 L200 110 L220 145 M190 130 L210 130" stroke="#555" stroke-width="5" fill="none"/>
  </svg>`
  return sharp(Buffer.from(svg)).png().toBuffer()
}

/** Dark pixels in a region of the PNG. */
async function darkCount(png: Buffer, x1: number, y1: number, x2: number, y2: number) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
  let n = 0
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) {
    const i = (y * info.width + x) * info.channels
    if (data[i]! + data[i + 1]! + data[i + 2]! < 3 * 128) n++
  }
  return n
}

async function pixel(png: Buffer, x: number, y: number) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true })
  const i = (y * info.width + x) * info.channels
  return [data[i]!, data[i + 1]!, data[i + 2]!] as const
}

describe('cleanFigure', () => {
  const figure = {
    description: 'diagram',
    bbox: { x: 50 / W, y: 50 / H, width: 300 / W, height: 200 / H },
    // Rough box, a few pixels off on every side, as models return them.
    blanks: [{ label: '7', bbox: { x: 106 / W, y: 95 / H, width: 188 / W, height: 70 / H }, ink: 'colour' as const, printedText: '7. ___' }],
  }

  it('snaps blanks to the printed box and keeps them relative to the crop', async () => {
    const out = await cleanFigure(await pageImage(), figure, { padding: 0 })
    expect([out.width, out.height]).toEqual([300, 200])
    const b = out.blanks[0]!.bbox
    expect(b.x * out.width).toBeCloseTo(50, -0.5)
    expect(b.y * out.height).toBeCloseTo(50, -0.5)
    expect((b.x + b.width) * out.width).toBeCloseTo(250, -0.5)
    expect((b.y + b.height) * out.height).toBeCloseTo(110, -0.5)
  })

  it('removes coloured handwriting but keeps printed marks', async () => {
    const out = await cleanFigure(await pageImage(), figure, { padding: 0 })
    const [r, g, b] = await pixel(out.png, 200 - 50, 130 - 50) // on the red stroke
    expect(r - Math.max(g, b)).toBeLessThan(10)
    const [tail] = await pixel(out.png, 236 - 50, 164 - 50) // stroke running past the box
    expect(tail).toBeGreaterThan(200)
    const printed = await pixel(out.png, 118 - 50, 130 - 50) // the "7." block
    expect(Math.max(...printed)).toBeLessThan(80)
    const border = await pixel(out.png, 100 - 50, 130 - 50) // box border
    expect(Math.max(...border)).toBeLessThan(80)
  })

  it('crops figures without blanks as they are', async () => {
    const out = await cleanFigure(await pageImage(), { ...figure, blanks: [] }, { padding: 0 })
    expect(out.blanks).toEqual([])
    expect([out.width, out.height]).toEqual([300, 200])
  })

  it('clears a pencil or black-pen blank and types its printed text back in', async () => {
    const dark = { ...figure, blanks: [{ ...figure.blanks[0]!, ink: 'dark' as const }] }
    const out = await cleanFigure(await pencilPage(), dark, { padding: 0 })
    expect(await darkCount(out.png, 175 - 50, 108 - 50, 225 - 50, 150 - 50)).toBe(0) // where the answer was
    expect(await darkCount(out.png, 105 - 50, 110 - 50, 150 - 50, 150 - 50)).toBeGreaterThan(20) // "7." typed back
    const border = await pixel(out.png, 100 - 50, 130 - 50)
    expect(Math.max(...border)).toBeLessThan(80)
    expect(out.blanks[0]).toMatchObject({ ink: 'dark', printedText: '7. ___' })
  })

  it('leaves pencil alone when the blank is not marked dark', async () => {
    const out = await cleanFigure(await pencilPage(), figure, { padding: 0 })
    expect(await darkCount(out.png, 175 - 50, 108 - 50, 225 - 50, 150 - 50)).toBeGreaterThan(20)
  })
})

describe('printedTextSvg', () => {
  it('spreads the pieces around the answer space across the box', () => {
    const svg = printedTextSvg('7. ___ host', 200, 50)
    expect(svg).toContain('text-anchor="start">7.</text>')
    expect(svg).toContain('text-anchor="end">host</text>')
  })

  it('puts each printed line in its own row and escapes markup', () => {
    const svg = printedTextSvg('Organ\n5. <b> ___', 120, 90)
    const ys = [...svg.matchAll(/y="([\d.]+)"/g)].map((m) => Number(m[1]))
    expect(ys[1]).toBeGreaterThan(ys[0]!)
    expect(svg).toContain('5. &lt;b&gt;')
  })
})

describe('defaultPrintedText', () => {
  it('prints plain labels with a full stop and leaves others as they are', async () => {
    const { defaultPrintedText } = await import('@exam/core')
    expect(defaultPrintedText('7')).toBe('7.')
    expect(defaultPrintedText('甲')).toBe('甲.')
    expect(defaultPrintedText('(a)')).toBe('(a)')
  })
})

describe('cleanFigure edges', () => {
  /** A graph at (112,50)-(300,250), and a ")" stroke at x 92-96 that a slightly wide box catches. */
  async function optionPage() {
    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${W}" height="${H}" fill="#fff"/>
      <rect x="92" y="60" width="4" height="30" fill="#111"/>
      <path d="M112 150 L300 150 M200 50 L200 250 M115 240 L290 60" stroke="#111" stroke-width="3" fill="none"/>
    </svg>`
    return sharp(Buffer.from(svg)).png().toBuffer()
  }

  it('leaves out a sliver of the next label that the box edge cuts through', async () => {
    const out = await cleanFigure(await optionPage(), { description: 'graph', bbox: { x: 94 / W, y: 45 / H, width: 210 / W, height: 210 / H }, blanks: [] }, { padding: 0 })
    expect(await darkCount(out.png, 0, 0, 4, out.height)).toBe(0)
    expect(out.width).toBeGreaterThan(195)
  })

  it('keeps a label inside the box that the edge does not touch', async () => {
    const out = await cleanFigure(await optionPage(), { description: 'graph', bbox: { x: 88 / W, y: 45 / H, width: 216 / W, height: 210 / H }, blanks: [] }, { padding: 0 })
    expect(await darkCount(out.png, 0, 0, 12, out.height)).toBeGreaterThan(0)
  })
})
