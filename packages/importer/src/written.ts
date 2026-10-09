import { extname } from 'node:path'
import type { Bank, ImportRecord } from '@exam/bank'
import type { DraftExam, PageImage } from '@exam/core'
import { cropExamFigures } from '@exam/figures'
import type { FileStore } from '@exam/files'
import { ingestBuffer, PageLimitError, storedPage } from '@exam/ingest'
import type { UploadFile } from './importer.ts'

/** `provider` of an exam the AI wrote from study material (講義、筆記) rather than read from an exam paper. */
export const WRITTEN = 'written'

/** Most pages of study material one exam is written from. */
export const MAX_MATERIAL_PAGES = 30

/** The error thrown when the material has more pages than MAX_MATERIAL_PAGES. */
export const TOO_MANY_PAGES = 'Too many pages of material'

/** A PDF longer than what is left of the material's pages ends as TOO_MANY_PAGES. */
const tooMany = (err: unknown): never => {
  throw err instanceof PageLimitError ? new Error(TOO_MANY_PAGES) : err
}

/** Text files read as plain text rather than rendered to pages. */
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.csv'])

/** The study material an exam is written from: rendered pages (with their PDF text, if any) and plain text. */
export interface Material {
  /** Page images as stored (WebP); `text` is the page's PDF text layer, when it has one. */
  pages: { pageNumber: number; text: string | null; image: Buffer }[]
  /** Text pasted in or read from text files. */
  text: string | null
}

/** Writes the exam from the material and what the person asked for; figures name a material page and a box on it. */
export type WriteExam = (material: Material, request: unknown) => Promise<DraftExam>

interface Saved {
  pages: { pageNumber: number; text: string | null }[]
  text: string | null
  request: unknown
}

/**
 * Exams the AI writes from study material. The material is kept with the import (its files under
 * `sources/` like any upload, its rendered pages under `material/`), so a failed run can be tried
 * again. The import has no exam pages of its own, so the editor shows the A4 sheet as for an exam
 * made from scratch; figures taken from the material are cropped from its pages and stored as usual.
 */
export class WrittenExams {
  private readonly running = new Map<string, Promise<void>>()

  constructor(
    private readonly bank: Bank,
    private readonly files: FileStore,
    private readonly base: (imp: Pick<ImportRecord, 'id' | 'ownerId'>) => string,
  ) {}

  /** Stores the material and an import waiting to be written; `request` is what to write, handed back to `start`. */
  async create(input: { ownerId: string; fileName: string; files: UploadFile[]; text: string | null; request: unknown; model: string | null }): Promise<ImportRecord> {
    const pages: PageImage[] = []
    const texts = input.text?.trim() ? [input.text.trim()] : []
    for (const f of input.files) {
      if (TEXT_EXTENSIONS.has(extname(f.name).toLowerCase())) {
        texts.push(`${f.name}\n${f.data.toString('utf8').trim()}`)
        continue
      }
      for (const page of (await ingestBuffer(f.name, f.data, { maxPages: MAX_MATERIAL_PAGES - pages.length }).catch(tooMany)).pages) {
        pages.push({ ...page, pageNumber: pages.length + 1 })
        if (pages.length > MAX_MATERIAL_PAGES) throw new Error(TOO_MANY_PAGES)
      }
    }
    const record = await this.bank.createImport({ ownerId: input.ownerId, fileName: input.fileName, pageCount: 0, provider: WRITTEN, model: input.model, pageFormat: 'webp' })
    const base = this.base(record)
    for (const [i, f] of input.files.entries()) await this.files.write(`${base}/sources/${i + 1}${extname(f.name).toLowerCase()}`, f.data)
    if (input.files.length) await this.files.write(`${base}/sources/names.json`, JSON.stringify(input.files.map((f) => f.name)))
    for (const page of pages) await this.files.write(`${base}/material/page-${page.pageNumber}.webp`, await storedPage(page.data))
    const saved: Saved = { pages: pages.map((p) => ({ pageNumber: p.pageNumber, text: p.textLayer })), text: texts.join('\n\n') || null, request: input.request }
    await this.files.write(`${base}/material/material.json`, JSON.stringify(saved))
    return record
  }

  /** Writes the exam in the background unless a run is already going; the import shows progress, then opens in the editor. */
  async start(imp: ImportRecord, write: WriteExam): Promise<void> {
    if (this.running.has(imp.id)) return
    await this.bank.updateImport(imp.id, { status: 'processing', error: null, progress: { done: 0, total: 1 } })
    const run = this.run(imp, write)
      .catch((err) => {
        console.error(`Writing exam ${imp.id} failed:`, err)
        return this.bank.updateImport(imp.id, { status: 'failed', error: err instanceof Error ? err.message : String(err) })
      })
      .finally(() => this.running.delete(imp.id))
    this.running.set(imp.id, run)
  }

  /** The first page of the material, shown while the exam is written; null for material given as text only. */
  async firstPage(imp: Pick<ImportRecord, 'id' | 'ownerId'>): Promise<string | null> {
    const saved = JSON.parse((await this.files.read(`${this.base(imp)}/material/material.json`))?.toString('utf8') ?? 'null') as Saved | null
    return saved?.pages.length ? `${this.base(imp)}/material/page-1.webp` : null
  }

  /** Resolves when the current run of an import, if any, is over. */
  async settled(id: string): Promise<void> {
    await this.running.get(id)
  }

  private async run(imp: ImportRecord, write: WriteExam): Promise<void> {
    const base = this.base(imp)
    const saved = JSON.parse((await this.files.read(`${base}/material/material.json`))?.toString('utf8') ?? 'null') as Saved | null
    if (!saved) throw new Error('The study material of this exam is missing')
    const pages = await Promise.all(
      saved.pages.map(async (p) => {
        const image = await this.files.read(`${base}/material/page-${p.pageNumber}.webp`)
        if (!image) throw new Error(`Page ${p.pageNumber} of the study material is missing`)
        return { pageNumber: p.pageNumber, text: p.text, image }
      }),
    )
    const draft = await write({ pages, text: saved.text }, saved.request)
    const pageImages: PageImage[] = pages.map((p) => ({ pageNumber: p.pageNumber, mimeType: 'image/webp', data: p.image, width: 0, height: 0, textLayer: null }))
    const failures = await cropExamFigures(draft, pageImages, async (name, png) => {
      const key = `${base}/figures/${name.replace(/[^\w-]+/g, '-')}.png`
      await this.files.write(key, png)
      return key
    })
    for (const f of failures) console.warn(`[written] figure ${f.name} of ${imp.id} could not be cropped: ${f.error}`)
    // A figure that could not be cropped is dropped rather than left pointing at a page the editor does not show.
    for (const holder of [...draft.groups, ...draft.questions]) holder.figures = holder.figures.filter((f) => f.image)
    await this.bank.saveDraft(imp.id, draft)
    await this.bank.updateImport(imp.id, { status: 'review', error: null, progress: { done: 1, total: 1 } })
  }
}
