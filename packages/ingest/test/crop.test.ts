import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { findPage, flattenPage, imagesToPdf } from '../src/index.ts'

/** A white sheet with dark lines on it, turned a little, lying on a dark desk. */
async function photo(): Promise<Buffer> {
  const lines = Array.from({ length: 12 }, (_, i) => `<rect x="60" y="${80 + i * 70}" width="${380 - (i % 3) * 60}" height="14" fill="#222"/>`).join('')
  const sheet = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700"><rect width="500" height="700" fill="#f4f4f0"/>${lines}</svg>`))
    .rotate(8, { background: '#303848' })
    .png()
    .toBuffer()
  const meta = await sharp(sheet).metadata()
  return sharp({ create: { width: 900, height: 1000, channels: 3, background: '#303848' } })
    .composite([{ input: sheet, left: Math.round((900 - meta.width!) / 2), top: Math.round((1000 - meta.height!) / 2) }])
    .png()
    .toBuffer()
}

describe('findPage', () => {
  it('finds the corners of a turned sheet on a desk', async () => {
    const quad = await findPage(await photo())
    expect(quad).not.toBeNull()
    const [tl, tr, br, bl] = quad!
    expect(tl.x).toBeLessThan(tr.x)
    expect(bl.x).toBeLessThan(br.x)
    expect(tl.y).toBeLessThan(bl.y)
    expect(tr.y).toBeLessThan(br.y)
    // the sheet is about 500 × 700 of 900 × 1000, turned 8°
    const width = Math.hypot((tr.x - tl.x) * 900, (tr.y - tl.y) * 1000)
    expect(width).toBeGreaterThan(480)
    expect(width).toBeLessThan(520)
  })

  it('leaves a page that already fills the image alone', async () => {
    const white = await sharp({ create: { width: 600, height: 800, channels: 3, background: '#ffffff' } }).png().toBuffer()
    expect(await findPage(white)).toBeNull()
  })

  it('flattens the found sheet into an upright rectangle about its own size', async () => {
    const input = await photo()
    const flat = await flattenPage(input, (await findPage(input))!)
    expect(flat.width).toBeGreaterThan(480)
    expect(flat.width).toBeLessThan(520)
    expect(flat.height).toBeGreaterThan(680)
    expect(flat.height).toBeLessThan(720)
    // the desk is cut away: the corners are paper
    const { data, info } = await sharp(flat.data).raw().toBuffer({ resolveWithObject: true })
    const at = (x: number, y: number) => data[(y * info.width + x) * info.channels]!
    expect(at(4, 4)).toBeGreaterThan(200)
    expect(at(info.width - 5, info.height - 5)).toBeGreaterThan(200)
  })
})

describe('imagesToPdf', () => {
  it('writes one A4-wide page per image', async () => {
    const page = await sharp({ create: { width: 200, height: 300, channels: 3, background: '#ffffff' } }).png().toBuffer()
    const pdf = (await imagesToPdf([page, page])).toString('latin1')
    expect(pdf.startsWith('%PDF-1.4')).toBe(true)
    expect(pdf).toContain('/Count 2')
    expect(pdf).toContain('/MediaBox [0 0 595.28 892.92]')
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true)
  })
})
