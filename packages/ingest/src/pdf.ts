import { createCanvas } from '@napi-rs/canvas'
import { getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PageImage } from '@exam/core'

export interface RenderOptions {
  /** Longest edge of the rendered page in pixels. */
  maxEdge: number
}

/** Renders each PDF page to PNG and collects its text layer, if any. */
export async function renderPdf(data: Uint8Array, opts: RenderOptions): Promise<PageImage[]> {
  // pdfjs takes ownership of the buffer it is given, so hand it a copy.
  const doc = await getDocument({ data: new Uint8Array(data), verbosity: 0 }).promise
  try {
    const pages: PageImage[] = []
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const base = page.getViewport({ scale: 1 })
      const scale = opts.maxEdge / Math.max(base.width, base.height)
      const viewport = page.getViewport({ scale })
      const width = Math.round(viewport.width)
      const height = Math.round(viewport.height)
      const canvas = createCanvas(width, height)
      const context = canvas.getContext('2d')
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise
      const png = canvas.toBuffer('image/png')

      const text = await page.getTextContent()
      const hidden = await invisibleFonts(page)
      const textLayer = text.items
        .map((item) => ('str' in item && !hidden.has(item.fontName) ? item.str + (item.hasEOL ? '\n' : '') : ''))
        .join('')
        .trim()

      pages.push({
        pageNumber: n,
        mimeType: 'image/png',
        data: png,
        width,
        height,
        textLayer: textLayer.length > 0 ? textLayer : null,
      })
      page.cleanup()
    }
    return pages
  } finally {
    await doc.destroy()
  }
}

/**
 * Fonts the page only draws invisibly (text render mode 3 or 7). Scanner apps and
 * note apps put their own recognition of the image there, handwriting included,
 * which is noise next to the image the model already sees.
 */
async function invisibleFonts(page: { getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }> }): Promise<Set<string>> {
  const ops = await page.getOperatorList()
  const visible = new Set<string>(), invisible = new Set<string>()
  const stack: [number, string | null][] = []
  let mode = 0, font: string | null = null
  ops.fnArray.forEach((fn, i) => {
    const args = ops.argsArray[i] as unknown[]
    if (fn === OPS.save) stack.push([mode, font])
    else if (fn === OPS.restore) [mode, font] = stack.pop() ?? [0, null]
    else if (fn === OPS.setTextRenderingMode) mode = Number(args[0])
    else if (fn === OPS.setFont) font = String(args[0])
    else if ((fn === OPS.showText || fn === OPS.showSpacedText) && font) (mode === 3 || mode === 7 ? invisible : visible).add(font)
  })
  for (const f of visible) invisible.delete(f)
  return invisible
}
