import { createCanvas } from '@napi-rs/canvas'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
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
      const textLayer = text.items
        .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
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
