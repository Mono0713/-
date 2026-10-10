import sharp from 'sharp'

// A4 width in PDF points; each page keeps its picture's shape at that width.
const A4_WIDTH = 595.28

/** A PDF with one page per image, each image filling an A4-wide page of its own shape (images as JPEG). */
export async function imagesToPdf(images: Buffer[]): Promise<Buffer> {
  const parts: Buffer[] = []
  const offsets: number[] = []
  let length = 0
  const push = (b: Buffer | string) => {
    const buf = typeof b === 'string' ? Buffer.from(b, 'latin1') : b
    parts.push(buf)
    length += buf.length
  }
  const object = (n: number, body: (Buffer | string)[]) => {
    offsets[n] = length
    push(`${n} 0 obj\n`)
    for (const b of body) push(b)
    push('\nendobj\n')
  }
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
  // objects: 1 catalog, 2 page tree, then per page: page, image, contents
  const kids = images.map((_, i) => `${3 + i * 3} 0 R`).join(' ')
  object(1, ['<< /Type /Catalog /Pages 2 0 R >>'])
  object(2, [`<< /Type /Pages /Kids [${kids}] /Count ${images.length} >>`])
  for (const [i, image] of images.entries()) {
    const { data, info } = await sharp(image, { failOn: 'none' }).flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true })
    const w = A4_WIDTH
    const h = +((A4_WIDTH * info.height) / info.width).toFixed(2)
    const page = 3 + i * 3
    const draw = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`
    object(page, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${page + 1} 0 R >> >> /Contents ${page + 2} 0 R >>`])
    object(page + 1, [`<< /Type /XObject /Subtype /Image /Width ${info.width} /Height ${info.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${data.length} >>\nstream\n`, data, '\nendstream'])
    object(page + 2, [`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`])
  }
  const count = 3 + images.length * 3
  const xref = length
  push(`xref\n0 ${count}\n0000000000 65535 f \n`)
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`)
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  return Buffer.concat(parts)
}
