import { extname } from 'node:path'
import type { Bank, ImportRecord } from '@exam/bank'
import type { DraftExam, DraftFigure, IngestedDocument, PageImage } from '@exam/core'
import { createProvider, extractDocument, ManualProvider, mergePages, type PageResult, type ProviderConfig, type TextFiles } from '@exam/extraction'
import type { FileStore } from '@exam/files'
import { cleanFigure, cropExamFigures } from '@exam/figures'
import { ingestBuffer } from '@exam/ingest'

export interface UploadFile {
  name: string
  data: Buffer
}

export interface ImporterOptions {
  bank: Bank
  /** Where uploaded files, page images, figures and manual-mode prompts are kept. */
  files: FileStore
  /**
   * Start of every file key of an owner's imports, e.g. "u/<owner>/" when several people
   * share a store, so a file link can be checked against the person asking. Default "".
   */
  keyPrefix?: (ownerId: string) => string
  /** Longest edge of page images. Default 2000. */
  maxEdge?: number
  /** Pages in flight per import. Default 2. */
  concurrency?: number
  /** Extra provider settings of the uploader, e.g. API keys and default models from a settings page. */
  providerConfig?: (providerId: string, ownerId: string) => ProviderConfig | Promise<ProviderConfig>
  /** Interface language of the uploader (e.g. "en", "zh-Hant"); the model writes review notes in it. */
  reviewLanguage?: (ownerId: string) => string | Promise<string>
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
 * Images it returns (page images, figures) are file store keys.
 */
export class Importer {
  private readonly running = new Map<string, Promise<void>>()

  constructor(private readonly opts: ImporterOptions) {}

  get bank(): Bank {
    return this.opts.bank
  }

  get files(): FileStore {
    return this.opts.files
  }

  /** Stores the upload, renders its pages and starts extraction in the background. */
  async create(input: { ownerId: string; files: UploadFile[]; provider: string; model?: string | null }): Promise<ImportRecord> {
    if (!input.files.length) throw new Error('No file uploaded')
    const doc = await this.ingest(input.files)
    const fileName = input.files.length === 1 ? input.files[0]!.name : `${input.files[0]!.name} 等 ${input.files.length} 個檔案`
    const record = await this.bank.createImport({ ownerId: input.ownerId, fileName, pageCount: doc.pages.length, provider: input.provider, model: input.model || null })
    const base = this.base(record)
    for (const [i, f] of input.files.entries()) await this.files.write(`${base}/sources/${i + 1}${sourceExt(f.name)}`, f.data)
    await this.files.write(`${base}/sources/names.json`, JSON.stringify(input.files.map((f) => f.name)))
    for (const page of doc.pages) await this.files.write(this.pageImage(record, page.pageNumber), page.data)
    await this.start(record.id)
    return record
  }

  /** Runs extraction for the given pages (all when omitted) unless a run is already going. */
  async start(id: string, pages?: number[]): Promise<void> {
    if (this.running.has(id)) return
    const imp = await this.require(id)
    // Mark it right away so a page rendered before rendering finishes already shows progress.
    await this.bank.updateImport(id, { status: 'processing', error: null, progress: { done: 0, total: pages?.length || imp.pageCount } })
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
  async rerun(id: string, opts: { provider?: string; model?: string | null; pages?: number[] } = {}): Promise<void> {
    if (opts.provider) await this.bank.updateImport(id, { provider: opts.provider, model: opts.model ?? null })
    await this.start(id, opts.pages)
  }

  /** File key of a rendered page. */
  pageImage(imp: Pick<ImportRecord, 'id' | 'ownerId'>, pageNumber: number): string {
    return `${this.base(imp)}/pages/page-${pageNumber}.png`
  }

  /**
   * Crops a figure again from its page, e.g. after a blank was switched to pencil mode
   * during review. The new image gets a new file name so browsers do not show a cached
   * one; the old file stays because saved questions may still use it.
   */
  async recropFigure(id: string, figure: DraftFigure): Promise<DraftFigure> {
    const imp = await this.require(id)
    const page = await this.files.read(this.pageImage(imp, figure.pageNumber))
    if (!page) throw new Error(`Page ${figure.pageNumber} of import ${id} is missing`)
    const clean = await cleanFigure(page, figure)
    const previous = figure.image?.file.split('/').pop()?.replace(/\.png$/, '')
    const base = previous ? previous.replace(/-r\d+$/, '') : 'figure'
    const name = `${base.replace(/[^\w-]+/g, '-')}-r${Date.now()}`
    const key = `${this.base(imp)}/figures/${name}.png`
    await this.files.write(key, clean.png)
    return { ...figure, image: { file: key, width: clean.width, height: clean.height, blanks: clean.blanks } }
  }

  /** Prompts to paste into a chat app for pages still waiting in manual mode. */
  async manualState(id: string): Promise<ManualState> {
    const imp = await this.require(id)
    const manual = this.manualProvider(imp)
    const results = await this.pageResults(id)
    const pages = await Promise.all(
      Array.from({ length: imp.pageCount }, async (_, i) => {
        const n = i + 1
        const result = results.find((r) => r.pageNumber === n)
        return {
          pageNumber: n,
          image: this.pageImage(imp, n),
          prompt: await manual.readPrompt(n),
          done: Boolean(result?.page),
          error: result?.error && !result.error.startsWith(WAITING) ? result.error : null,
        }
      }),
    )
    const waiting = pages.filter((p) => !p.done && p.prompt).map((p) => p.pageNumber)
    const batchPrompt = waiting.length > 1 ? await manual.readBatchPrompt() : null
    return { pages, batch: batchPrompt ? { pages: waiting, prompt: batchPrompt } : null }
  }

  /** Saves a reply pasted from a chat app (for one page, or "batch" for all waiting pages) and re-runs those pages. */
  async submitManualReply(id: string, target: number | 'batch', text: string): Promise<void> {
    const imp = await this.require(id)
    await this.manualProvider(imp).writeReply(target, text)
    const results = await this.pageResults(id)
    const pending = results.filter((r) => !r.page).map((r) => r.pageNumber)
    await this.start(id, target === 'batch' ? pending : [target])
  }

  async saveDraft(id: string, draft: DraftExam): Promise<void> {
    await this.require(id)
    await this.bank.saveDraft(id, draft)
  }

  /** Puts the reviewed draft into the bank as an exam; publishing again updates that exam. */
  async publish(id: string, draft: DraftExam) {
    await this.bank.saveDraft(id, draft)
    return this.bank.saveExam(id, draft)
  }

  /** Deletes the import and its files. Questions already in the bank stay, and so do the figure images they show. */
  async remove(id: string): Promise<void> {
    await this.settled(id)
    const imp = await this.require(id)
    const inBank = (await this.bank.examForImport(imp.id)) !== null
    await this.bank.deleteImport(id)
    const base = this.base(imp)
    const keys = await this.files.list(`${base}/`)
    await this.files.remove(inBank ? keys.filter((k) => !k.startsWith(`${base}/figures/`)) : keys)
  }

  private async run(id: string, pages?: number[]): Promise<void> {
    const imp = await this.require(id)
    const doc = await this.load(imp)
    const selected = pages?.length ? pages : doc.pages.map((p) => p.pageNumber)
    let done = 0
    await this.bank.updateImport(id, { status: 'processing', error: null, progress: { done, total: selected.length } })

    const config = await this.opts.providerConfig?.(imp.provider, imp.ownerId)
    const provider = createProvider(imp.provider, { ...config, model: imp.model ?? config?.model, files: this.manualFiles(imp) })
    const fresh = await extractDocument(provider, doc, {
      concurrency: this.opts.concurrency ?? 2,
      pages: selected,
      reviewLanguage: await this.opts.reviewLanguage?.(imp.ownerId),
      onPage: () => void this.bank.updateImport(id, { progress: { done: ++done, total: selected.length } }).catch(() => {}),
    })
    const results = await this.saveResults(imp, fresh)

    if (results.some((r) => r.error?.startsWith(WAITING))) {
      if (provider instanceof ManualProvider) await provider.writeBatchPrompt()
      await this.bank.updateImport(id, { status: 'waiting' })
      return
    }
    if (!results.some((r) => r.page)) {
      await this.bank.updateImport(id, { status: 'failed', error: results.find((r) => r.error)?.error ?? 'No page could be read' })
      return
    }
    const exam = mergePages(imp.fileName, results)
    await cropExamFigures(exam, doc.pages, async (name, png) => {
      const key = `${this.base(imp)}/figures/${name}.png`
      await this.files.write(key, png)
      return key
    })
    await this.bank.saveDraft(id, exam)
    await this.bank.updateImport(id, { status: 'review' })
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
  private async load(imp: ImportRecord): Promise<IngestedDocument> {
    const dir = `${this.base(imp)}/sources`
    const names = JSON.parse((await this.files.read(`${dir}/names.json`))?.toString('utf8') ?? 'null') as string[] | null
    if (!names) throw new Error('The uploaded files are missing')
    const stored = await this.files.list(`${dir}/`)
    const files = await Promise.all(
      names.map(async (name, i) => {
        const key = stored.find((k) => k.slice(dir.length + 1).startsWith(`${i + 1}.`))
        const data = key ? await this.files.read(key) : null
        if (!data) throw new Error(`Uploaded file ${name} is missing`)
        return { name, data }
      }),
    )
    return this.ingest(files)
  }

  /** Latest result of every page that has been sent to a model. */
  async pageResults(id: string): Promise<PageResult[]> {
    const imp = await this.bank.getImport(id)
    const saved = imp ? await this.files.read(`${this.base(imp)}/results.json`) : null
    return saved ? (JSON.parse(saved.toString('utf8')) as PageResult[]) : []
  }

  /** Replaces re-run pages in the stored results and keeps the rest. */
  private async saveResults(imp: ImportRecord, fresh: PageResult[]): Promise<PageResult[]> {
    const byPage = new Map((await this.pageResults(imp.id)).map((r) => [r.pageNumber, r]))
    for (const r of fresh) byPage.set(r.pageNumber, r)
    const results = [...byPage.values()].sort((a, b) => a.pageNumber - b.pageNumber)
    await this.files.write(`${this.base(imp)}/results.json`, JSON.stringify(results, null, 2))
    return results
  }

  /** Manual-mode prompts and replies, kept with the import's other files. */
  private manualFiles(imp: ImportRecord): TextFiles {
    const dir = `${this.base(imp)}/manual`
    return {
      read: async (name) => (await this.files.read(`${dir}/${name}`))?.toString('utf8') ?? null,
      write: (name, text) => this.files.write(`${dir}/${name}`, text),
    }
  }

  private manualProvider(imp: ImportRecord): ManualProvider {
    return new ManualProvider({ files: this.manualFiles(imp) })
  }

  private base(imp: Pick<ImportRecord, 'id' | 'ownerId'>): string {
    if (!/^[\w-]+$/.test(imp.id)) throw new Error('Invalid import id')
    return `${this.opts.keyPrefix?.(imp.ownerId) ?? ''}imports/${imp.id}`
  }

  private async require(id: string): Promise<ImportRecord> {
    const imp = await this.bank.getImport(id)
    if (!imp) throw new Error(`Import ${id} not found`)
    return imp
  }
}

/** Extension of an uploaded file for its stored copy; anything odd becomes ".bin". */
function sourceExt(name: string): string {
  const ext = extname(name).toLowerCase()
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : '.bin'
}
