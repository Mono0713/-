import { isFullQuad, remapBox, remapBoxes, type IngestedDocument, type PageImage, type Quad } from '@exam/core'
import type { ImportRecord } from '@exam/bank'
import type { FileStore } from '@exam/files'
import { findPage, flattenPage, storedPage } from '@exam/ingest'
import type { PageResult } from '@exam/extraction'

type Imp = Pick<ImportRecord, 'id' | 'ownerId' | 'pageFormat'>

/**
 * Where the paper is on each photographed page. A photo's sheet is found when it is uploaded and
 * flattened into a rectangle before the AI reads it; the photo as taken is kept beside the page
 * (`raw-N.webp`), so the cut can be changed any time. `crops.json` holds each page's corners on
 * that photo (null: the whole photo); a page not in it is shown as it was rendered.
 */
export class PageCrops {
  constructor(
    private readonly files: FileStore,
    private readonly base: (imp: Imp) => string,
    private readonly pageImage: (imp: Imp, pageNumber: number) => string,
    private readonly maxEdge: number,
  ) {}

  rawKey(imp: Imp, pageNumber: number): string {
    return `${this.base(imp)}/pages/raw-${pageNumber}.webp`
  }

  async read(imp: Imp): Promise<Record<number, Quad | null>> {
    const saved = await this.files.read(`${this.base(imp)}/pages/crops.json`)
    return saved ? (JSON.parse(saved.toString('utf8')) as Record<number, Quad | null>) : {}
  }

  private async save(imp: Imp, crops: Record<number, Quad | null>) {
    await this.files.write(`${this.base(imp)}/pages/crops.json`, JSON.stringify(crops))
  }

  /**
   * Freshly uploaded pages: each photo (a page without a PDF text layer) whose sheet is found keeps
   * its photo and is flattened. Returns the pages as they are to be shown and read.
   */
  async frameNew(imp: Imp, pages: PageImage[]): Promise<PageImage[]> {
    const crops: Record<number, Quad> = {}
    const out: PageImage[] = []
    for (const page of pages) {
      const quad = page.textLayer === null ? await findPage(page.data).catch(() => null) : null
      if (!quad) {
        out.push(page)
        continue
      }
      await this.files.write(this.rawKey(imp, page.pageNumber), await storedPage(page.data))
      const flat = await flattenPage(page.data, quad, this.maxEdge)
      crops[page.pageNumber] = quad
      out.push({ ...page, data: flat.data, width: flat.width, height: flat.height, mimeType: 'image/png' })
    }
    if (Object.keys(crops).length) await this.save(imp, crops)
    return out
  }

  /** Pages rendered again from the upload, cut the way they were saved. */
  async apply(imp: Imp, doc: IngestedDocument): Promise<IngestedDocument> {
    const crops = await this.read(imp)
    if (!Object.values(crops).some(Boolean)) return doc
    const pages = await Promise.all(
      doc.pages.map(async (page) => {
        const quad = crops[page.pageNumber]
        if (!quad) return page
        const flat = await flattenPage(page.data, quad, this.maxEdge)
        return { ...page, data: flat.data, width: flat.width, height: flat.height, mimeType: 'image/png' as const }
      }),
    )
    return { ...doc, pages }
  }

  /** The photo of a page as taken, saved from the page itself the first time (a page cut before this existed). */
  private async raw(imp: Imp, pageNumber: number): Promise<Buffer> {
    const key = this.rawKey(imp, pageNumber)
    const raw = await this.files.read(key)
    if (raw) return raw
    const page = await this.files.read(this.pageImage(imp, pageNumber))
    if (!page) throw new Error(`Page ${pageNumber} of import ${imp.id} is missing`)
    await this.files.write(key, page)
    return page
  }

  /** Where the sheet is on the page's photo, found again; null when no clear sheet is found. */
  async detect(imp: Imp, pageNumber: number): Promise<Quad | null> {
    return findPage(await this.raw(imp, pageNumber))
  }

  /**
   * Cuts page `pageNumber` along `quad` (null or the whole photo: not cut), saves it, and moves the
   * boxes of the page readings with it, so reading other pages again keeps them in place. The draft's
   * boxes are moved by the editor, which holds the latest draft. Returns the corners it had before.
   */
  async set(imp: Imp, pageNumber: number, quad: Quad | null): Promise<Quad | null> {
    const next = isFullQuad(quad) ? null : quad
    const raw = await this.raw(imp, pageNumber)
    const crops = await this.read(imp)
    const before = crops[pageNumber] ?? null
    const page = next ? await storedPage((await flattenPage(raw, next, this.maxEdge)).data) : raw
    await this.files.write(this.pageImage(imp, pageNumber), page)
    await this.save(imp, { ...crops, [pageNumber]: next })
    const key = `${this.base(imp)}/results.json`
    const saved = await this.files.read(key)
    if (saved) {
      const results = JSON.parse(saved.toString('utf8')) as PageResult[]
      const moved = results.map((r) => (r.pageNumber === pageNumber ? remapBoxes(r, (b) => remapBox(b, before, next)) : r))
      await this.files.write(key, JSON.stringify(moved))
    }
    return before
  }
}
