import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { ingestFile } from '../src/index.ts'

/** Smallest useful PDF: one A4 page with a line of text. */
function tinyPdf(text: string): Buffer {
  const content = `BT /F1 24 Tf 72 720 Td (${text}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  objects.forEach((obj, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(body, 'latin1')
}

describe('ingestFile', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ingest-'))

  it('renders PDF pages to PNG at the requested size and keeps the text layer', async () => {
    const path = join(dir, 'quiz.pdf')
    await writeFile(path, tinyPdf('Question 1'))
    const doc = await ingestFile(path, { maxEdge: 1000 })
    expect(doc.kind).toBe('pdf')
    expect(doc.pages).toHaveLength(1)
    const page = doc.pages[0]!
    expect(page.height).toBe(1000)
    expect(page.width).toBe(Math.round((595 / 842) * 1000))
    expect(page.textLayer).toContain('Question 1')
    const meta = await sharp(page.data).metadata()
    expect(meta.format).toBe('png')
  })

  it('shrinks large photos and applies EXIF rotation', async () => {
    const path = join(dir, 'photo.jpg')
    // 3000x1000 landscape pixels tagged as rotated 90°, so it should come out portrait.
    const jpg = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: '#fff' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer()
    await writeFile(path, jpg)
    const doc = await ingestFile(path, { maxEdge: 1500 })
    expect(doc.kind).toBe('image')
    expect(doc.pages[0]).toMatchObject({ width: 500, height: 1500, textLayer: null, mimeType: 'image/png' })
  })

  it('rejects unsupported files', async () => {
    const path = join(dir, 'notes.docx')
    await writeFile(path, 'x')
    await expect(ingestFile(path)).rejects.toThrow(/Unsupported file type/)
  })
})
