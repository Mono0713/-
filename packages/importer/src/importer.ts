import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type { Bank, ImportRecord } from '@exam/bank'
import type { DraftExam, DraftFigure, IngestedDocument, PageImage } from '@exam/core'
import { createProvider, extractDocument, ManualProvider, mergePages, type PageResult, type ProviderConfig } from '@exam/extraction'
import { cleanFigure, cropExamFigures } from '@exam/figures'
import { ingestBuffer } from '@exam/ingest'

export interface UploadFile {
  name: string
  data: Buffer
}

export interface ImporterOptions {
  bank: Bank
  /** Folder for uploaded files, page images, figures and manual-mode prompts. */
  dataDir: string
  /** Longest edge of page images. Default 2000. */
  maxEdge?: number
  /** Pages in flight per import. Default 2. */
  concurrency?: number
  /** Extra provider settings, e.g. API keys from a settings page. */
  providerConfig?: (providerId: string) => ProviderConfig
}

export interface ManualState {
  /** error: why the last pasted reply for this page was rejected. */
  pages: { pageNumber: number; image: string; prompt: string | null; done: boolean; error: string | null }[]
  /** One prompt covering every waiting page, when more than one is waiting. */
  batch: { pages: number[]; prompt: string } | null
}

const WAITING = 'waiting for a reply'

/**
 * Runs an uploaded exam through ingest, extraction and figure cropping, and keeps
 * its state in the bank. Knows nothing about the web: any front end calls these methods.
 * Paths it returns (page images, figures) are relative to dataDir.
 */
export class Importer {
  private readonly running = new Map<string, Promise<void>>()

  constructor(private readonly opts: ImporterOptions) {}

  get bank(): Bank {
    return this.opts.bank
  }

  /** Stores the upload, renders its pages and starts extraction in the background. */
  async create(input: { ownerId: string; files: UploadFile[]; provider: string; model?: string | null }): Promise<ImportRecord> {
    if (!input.files.length) throw new Error('No file uploaded')
    const doc = await this.ingest(input.files)
    const fileName = input.files.length === 1 ? input.files[0]!.name : `${input.files[0]!.name} 等 ${input.files.length} 個檔案`
    const record = this.bank.createImport({ ownerId: input.ownerId, fileName, pageCount: doc.pages.length, provider: input.provider, model: input.model || null })
    const dir = this.dir(record.id)
    await mkdir(join(dir, 'sources'), { recursive: true })
    await mkdir(join(dir, 'pages'), { recursive: true })
    for (const [i, f] of input.files.entries()) await writeFile(join(dir, 'sources', `${i + 1}${extname(f.name).toLowerCase()}`), f.data)
    await writeFile(join(dir, 'sources', 'names.json'), JSON.stringify(input.files.map((f) => f.name)))
    for (const page of doc.pages) await writeFile(join(dir, 'pages', `page-${page.pageNumber}.png`), page.data)
    this.start(record.id)
    return record
  }

  /** Runs extraction for the given pages (all when omitted) unless a run is already going. */
  start(id: string, pages?: number[]): void {
    if (this.running.has(id)) return
    // Mark it right away so a page rendered before rendering finishes already shows progress.
    this.bank.updateImport(id, { status: 'processing', error: null, progress: { done: 0, total: pages?.length || this.require(id).pageCount } })
    const run = this.run(id, pages)
      .catch((err) => this.bank.updateImport(id, { status: 'failed', error: err instanceof Error ? err.message : String(err) }))
      .finally(() => this.running.delete(id))
    this.running.set(id, run)
  }

  /** Resolves when the current run of an import, if any, is over. */
  async settled(id: string): Promise<void> {
    await this.running.get(id)
  }

  /** Switches model and re-reads the given pages (all when omitted). */
  rerun(id: string, opts: { provider?: string; model?: string | null; pages?: number[] } = {}): void {
    if (opts.provider) this.bank.updateImport(id, { provider: opts.provider, model: opts.model ?? null })
    this.start(id, opts.pages)
  }

  pageImage(id: string, pageNumber: number): string {
    return `imports/${id}/pages/page-${pageNumber}.png`
  }

  /**
   * Crops a figure again from its page, e.g. after a blank was switched to pencil mode
   * during review. The new image gets a new file name so browsers do not show a cached
   * one; the old file stays because saved questions may still use it.
   */
  async recropFigure(id: string, figure: DraftFigure): Promise<DraftFigure> {
    this.require(id)
    const page = await readFile(join(this.opts.dataDir, this.pageImage(id, figure.pageNumber)))
    const clean = await cleanFigure(page, figure)
    const base = figure.image ? basename(figure.image.file, '.png').replace(/-r\d+$/, '') : 'figure'
    const name = `${base.replace(/[^\w-]+/g, '-')}-r${Date.now()}`
    await mkdir(join(this.dir(id), 'figures'), { recursive: true })
    await writeFile(join(this.dir(id), 'figures', `${name}.png`), clean.png)
    return { ...figure, image: { file: `imports/${id}/figures/${name}.png`, width: clean.width, height: clean.height, blanks: clean.blanks } }
  }

  /** Prompts to paste into a chat app for pages still waiting in manual mode. */
  async manualState(id: string): Promise<ManualState> {
    const imp = this.require(id)
    const manual = this.manualProvider(id)
    const results = await this.pageResults(id)
    const pages = await Promise.all(
      Array.from({ length: imp.pageCount }, async (_, i) => {
        const n = i + 1
        const result = results.find((r) => r.pageNumber === n)
        const promptPath = manual.promptPath(n)
        return {
          pageNumber: n,
          image: this.pageImage(id, n),
          prompt: existsSync(promptPath) ? await readFile(promptPath, 'utf8') : null,
          done: Boolean(result?.page),
          error: result?.error && !result.error.startsWith(WAITING) ? result.error : null,
        }
      }),
    )
    const waiting = pages.filter((p) => !p.done && p.prompt).map((p) => p.pageNumber)
    const batch = waiting.length > 1 && existsSync(manual.batchPromptPath) ? { pages: waiting, prompt: await readFile(manual.batchPromptPath, 'utf8') } : null
    return { pages, batch }
  }

  /** Saves a reply pasted from a chat app (for one page, or "batch" for all waiting pages) and re-runs those pages. */
  async submitManualReply(id: string, target: number | 'batch', text: string): Promise<void> {
    const manual = this.manualProvider(id)
    await mkdir(join(this.dir(id), 'manual'), { recursive: true })
    await writeFile(target === 'batch' ? manual.batchReplyPath : manual.replyPath(target), text)
    const results = await this.pageResults(id)
    const pending = results.filter((r) => !r.page).map((r) => r.pageNumber)
    this.start(id, target === 'batch' ? pending : [target])
  }

  saveDraft(id: string, draft: DraftExam): void {
    this.require(id)
    this.bank.saveDraft(id, draft)
  }

  /** Puts the reviewed draft into the bank as an exam; publishing again updates that exam. */
  publish(id: string, draft: DraftExam) {
    this.bank.saveDraft(id, draft)
    return this.bank.saveExam(id, draft)
  }

  /** Deletes the import and its files. Questions already in the bank stay, and so do the figure images they show. */
  async remove(id: string): Promise<void> {
    await this.settled(id)
    const imp = this.require(id)
    const inBank = this.bank.examForImport(imp.id) !== null
    this.bank.deleteImport(id)
    if (!inBank) {
      await rm(this.dir(id), { recursive: true, force: true })
      return
    }
    for (const entry of await readdir(this.dir(id))) {
      if (entry !== 'figures') await rm(join(this.dir(id), entry), { recursive: true, force: true })
    }
  }

  private async run(id: string, pages?: number[]): Promise<void> {
    const imp = this.require(id)
    const doc = await this.load(id)
    const selected = pages?.length ? pages : doc.pages.map((p) => p.pageNumber)
    let done = 0
    this.bank.updateImport(id, { status: 'processing', error: null, progress: { done, total: selected.length } })

    const provider = createProvider(imp.provider, { ...this.opts.providerConfig?.(imp.provider), model: imp.model ?? undefined, workDir: join(this.dir(id), 'manual') })
    const fresh = await extractDocument(provider, doc, {
      concurrency: this.opts.concurrency ?? 2,
      pages: selected,
      onPage: () => this.bank.updateImport(id, { progress: { done: ++done, total: selected.length } }),
    })
    const results = await this.saveResults(id, fresh)

    if (results.some((r) => r.error?.startsWith(WAITING))) {
      if (provider instanceof ManualProvider) await provider.writeBatchPrompt()
      this.bank.updateImport(id, { status: 'waiting' })
      return
    }
    if (!results.some((r) => r.page)) {
      this.bank.updateImport(id, { status: 'failed', error: results.find((r) => r.error)?.error ?? 'No page could be read' })
      return
    }
    const exam = mergePages(imp.fileName, results)
    await mkdir(join(this.dir(id), 'figures'), { recursive: true })
    await cropExamFigures(exam, doc.pages, async (name, png) => {
      await writeFile(join(this.dir(id), 'figures', `${name}.png`), png)
      return `imports/${id}/figures/${name}.png`
    })
    this.bank.saveDraft(id, exam)
    this.bank.updateImport(id, { status: 'review' })
  }

  private async ingest(files: UploadFile[]): Promise<IngestedDocument> {
    const pages: PageImage[] = []
    for (const f of files) {
      const doc = await ingestBuffer(f.name, f.data, { maxEdge: this.opts.maxEdge })
      for (const page of doc.pages) pages.push({ ...page, pageNumber: pages.length + 1 })
    }
    return { fileName: files[0]!.name, kind: files.length === 1 && extname(files[0]!.name).toLowerCase() === '.pdf' ? 'pdf' : 'image', pages }
  }

  /** Re-renders the stored upload; rendering is deterministic, so page images match the first run. */
  private async load(id: string): Promise<IngestedDocument> {
    const dir = join(this.dir(id), 'sources')
    const names = JSON.parse(await readFile(join(dir, 'names.json'), 'utf8')) as string[]
    const stored = (await readdir(dir)).filter((f) => f !== 'names.json')
    const files = await Promise.all(
      names.map(async (name, i) => {
        const file = stored.find((f) => f.startsWith(`${i + 1}.`))
        if (!file) throw new Error(`Uploaded file ${name} is missing`)
        return { name, data: await readFile(join(dir, file)) }
      }),
    )
    return this.ingest(files)
  }

  /** Latest result of every page that has been sent to a model. */
  async pageResults(id: string): Promise<PageResult[]> {
    const path = join(this.dir(id), 'results.json')
    return existsSync(path) ? (JSON.parse(await readFile(path, 'utf8')) as PageResult[]) : []
  }

  /** Replaces re-run pages in the stored results and keeps the rest. */
  private async saveResults(id: string, fresh: PageResult[]): Promise<PageResult[]> {
    const byPage = new Map((await this.pageResults(id)).map((r) => [r.pageNumber, r]))
    for (const r of fresh) byPage.set(r.pageNumber, r)
    const results = [...byPage.values()].sort((a, b) => a.pageNumber - b.pageNumber)
    await writeFile(join(this.dir(id), 'results.json'), JSON.stringify(results, null, 2))
    return results
  }

  private manualProvider(id: string): ManualProvider {
    return new ManualProvider({ workDir: join(this.dir(id), 'manual') })
  }

  private dir(id: string): string {
    if (!/^[\w-]+$/.test(id)) throw new Error('Invalid import id')
    return join(this.opts.dataDir, 'imports', id)
  }

  private require(id: string): ImportRecord {
    const imp = this.bank.getImport(id)
    if (!imp) throw new Error(`Import ${id} not found`)
    return imp
  }
}
