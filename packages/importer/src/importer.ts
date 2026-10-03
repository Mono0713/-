import { extname } from 'node:path'
import type { Bank, ImportRecord } from '@exam/bank'
import type { DraftExam, DraftFigure, ExtractedPage, IngestedDocument, PageImage } from '@exam/core'
import { createProvider, extractDocument, keepEdits, ManualProvider, mergePages, type PageResult, type ProviderConfig, type TextFiles } from '@exam/extraction'
import type { FileStore } from '@exam/files'
import { cleanFigure, cropExamFigures } from '@exam/figures'
import { ingestBuffer, storedPage } from '@exam/ingest'

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
  /** Models for an AUTO import of this owner; null when no provider can read pages for them. */
  plan?: (ownerId: string) => Promise<ReadingPlan | null>
  /** Told about every page a model read (or failed to), e.g. to log usage. */
  onPage?: (imp: ImportRecord, result: PageResult) => void
}

/** A provider and, optionally, one of its models. */
export interface ModelPick {
  provider: string
  model?: string | null
}

/**
 * How an import set to AUTO is read: the first model, the ones that take over pages it
 * could not read (an outage, a used-up quota), and the one doubtful pages are read again with.
 */
export interface ReadingPlan {
  primary: ModelPick
  fallbacks: ModelPick[]
  escalate: ModelPick | null
}

/** The provider id of an import whose models are picked by `plan` when it runs. */
export const AUTO = 'auto'

export interface ManualState {
  /** error: why the last pasted reply for this page was rejected. */
  pages: { pageNumber: number; image: string; prompt: string | null; done: boolean; error: string | null }[]
  /** One prompt covering every waiting page, when more than one is waiting. */
  batch: { pages: number[]; prompt: string } | null
}

const WAITING = 'waiting for a reply'

/** `provider` of an exam made from scratch rather than read from a file. */
export const BLANK = 'blank'

/** Days the uploaded files stay after an import is first saved to the bank, unless the owner keeps them. */
export const ORIGINAL_DAYS = 30

/** The error of a reading cut off when the server stopped (a restart or a deploy). */
export const INTERRUPTED = 'Reading was interrupted because the server restarted'

/**
 * Runs an uploaded exam through ingest, extraction and figure cropping, and keeps
 * its state in the bank. Knows nothing about the web: any front end calls these methods.
 * Images it returns (page images, figures) are file store keys.
 */
export class Importer {
  private readonly running = new Map<string, Promise<void>>()
  /** Runs start only after interrupted imports were marked, so a new run is never mistaken for one. */
  private recovered: Promise<unknown> = Promise.resolve()

  constructor(private readonly opts: ImporterOptions) {}

  get bank(): Bank {
    return this.opts.bank
  }

  get files(): FileStore {
    return this.opts.files
  }

  /**
   * An exam written from scratch: no file and no pages, just an empty draft that opens
   * straight in the editor, where questions are added by hand.
   */
  async createBlank(ownerId: string): Promise<ImportRecord> {
    const record = await this.bank.createImport({ ownerId, fileName: '新考卷', pageCount: 0, provider: BLANK, model: null })
    const draft: DraftExam = {
      fileName: '新考卷',
      meta: { title: null, subject: null, institution: null, term: null, language: null },
      groups: [],
      questions: [],
      pages: [],
    }
    await this.bank.saveDraft(record.id, draft)
    await this.bank.updateImport(record.id, { status: 'review' })
    return (await this.bank.getImport(record.id)) ?? record
  }

  /** Stores the upload, renders its pages and starts extraction in the background. */
  async create(input: { ownerId: string; files: UploadFile[]; provider: string; model?: string | null }): Promise<ImportRecord> {
    if (!input.files.length) throw new Error('No file uploaded')
    const doc = await this.ingest(input.files)
    const fileName = input.files.length === 1 ? input.files[0]!.name : `${input.files[0]!.name} 等 ${input.files.length} 個檔案`
    const record = await this.bank.createImport({ ownerId: input.ownerId, fileName, pageCount: doc.pages.length, provider: input.provider, model: input.model || null, pageFormat: 'webp' })
    const base = this.base(record)
    for (const [i, f] of input.files.entries()) await this.files.write(`${base}/sources/${i + 1}${sourceExt(f.name)}`, f.data)
    await this.files.write(`${base}/sources/names.json`, JSON.stringify(input.files.map((f) => f.name)))
    for (const page of doc.pages) await this.files.write(this.pageImage(record, page.pageNumber), await storedPage(page.data))
    await this.start(record.id)
    return record
  }

  /** Runs extraction for the given pages (all when omitted) unless a run is already going. */
  async start(id: string, pages?: number[]): Promise<void> {
    await this.recovered
    if (this.running.has(id)) return
    const imp = await this.require(id)
    // Mark it right away so a page rendered before rendering finishes already shows progress.
    await this.bank.updateImport(id, { status: 'processing', error: null, progress: { done: 0, total: pages?.length || imp.pageCount } })
    const run = this.run(id, pages)
      .catch((err) => {
        console.error(`Reading import ${id} failed:`, err)
        return this.bank.updateImport(id, { status: 'failed', error: err instanceof Error ? err.message : String(err) })
      })
      .finally(() => this.running.delete(id))
    this.running.set(id, run)
  }

  /**
   * Readings run inside this server, so after a restart any import still "processing" will never
   * finish: it is marked failed, to be read again. Call once when the server starts, before any run.
   */
  recoverInterrupted(): Promise<number> {
    const done = this.bank.failInterrupted(INTERRUPTED)
    this.recovered = done.catch(() => {})
    return done
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
  pageImage(imp: Pick<ImportRecord, 'id' | 'ownerId' | 'pageFormat'>, pageNumber: number): string {
    return `${this.base(imp)}/pages/page-${pageNumber}.${imp.pageFormat ?? 'png'}`
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

  /** The uploaded files of an import, as file keys with the names they were uploaded under; empty once deleted. */
  async originals(id: string): Promise<{ name: string; key: string }[]> {
    const imp = await this.require(id)
    const dir = `${this.base(imp)}/sources`
    const names = JSON.parse((await this.files.read(`${dir}/names.json`))?.toString('utf8') ?? 'null') as string[] | null
    if (!names) return []
    const stored = await this.files.list(`${dir}/`)
    return names.flatMap((name, i) => {
      const key = stored.find((k) => k.slice(dir.length + 1).startsWith(`${i + 1}.`))
      return key ? [{ name, key }] : []
    })
  }

  /**
   * Deletes the uploaded files of imports saved to the bank more than ORIGINAL_DAYS ago, unless
   * their owner keeps them. Page images stay, so the review page and reading again still work.
   * Returns how many imports lost their files.
   */
  async expireOriginals(now = new Date()): Promise<number> {
    const due = await this.bank.originalsToExpire(new Date(now.getTime() - ORIGINAL_DAYS * 86_400_000))
    for (const imp of due) {
      if (this.running.has(imp.id)) continue
      const dir = `${this.base(imp)}/sources/`
      await this.files.remove(await this.files.list(dir))
      await this.bank.updateImport(imp.id, { originalDeletedAt: now.toISOString() })
    }
    return due.length
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

    const plan = await this.planFor(imp)
    const reviewLanguage = await this.opts.reviewLanguage?.(imp.ownerId)
    const read = async (pick: ModelPick, list: number[], progress: boolean) => {
      const config = await this.opts.providerConfig?.(pick.provider, imp.ownerId)
      const provider = createProvider(pick.provider, { ...config, model: pick.model ?? config?.model, files: this.manualFiles(imp) })
      const results = await extractDocument(provider, doc, {
        concurrency: this.opts.concurrency ?? 2,
        pages: list,
        reviewLanguage,
        onPage: (r) => {
          if (!(provider instanceof ManualProvider)) this.opts.onPage?.(imp, r)
          if (progress) void this.bank.updateImport(id, { progress: { done: ++done, total: selected.length } }).catch(() => {})
        },
      })
      return { provider, results }
    }
    const first = await read(plan.primary, selected, true)
    const provider = first.provider
    let fresh = first.results
    // Pages the first model could not read go to the next provider, then the next.
    for (const fallback of plan.fallbacks) {
      const failed = fresh.filter((r) => !r.page && !r.error?.startsWith(WAITING)).map((r) => r.pageNumber)
      if (!failed.length) break
      fresh = replaceRead(fresh, (await read(fallback, failed, false)).results)
    }
    // Pages read with doubts are read again by the stronger model; its reading wins when it succeeds.
    if (plan.escalate) {
      const doubtful = fresh.filter((r) => r.page && isDoubtful(r.page)).map((r) => r.pageNumber)
      if (doubtful.length) fresh = replaceRead(fresh, (await read(plan.escalate, doubtful, false)).results)
    }
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
    // Reading more pages must not undo what the person already changed on the others.
    const previous = await this.bank.getDraft(id)
    const exam = previous ? keepEdits(previous, mergePages(imp.fileName, results), new Set(selected)) : mergePages(imp.fileName, results)
    // Figures already in the draft keep their images; new crops get names that cannot overwrite them.
    const stamp = previous ? `-${Date.now().toString(36)}` : ''
    await cropExamFigures(exam, doc.pages, async (name, png) => {
      const key = `${this.base(imp)}/figures/${name}${stamp}.png`
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

  /**
   * Re-renders the stored upload; rendering is deterministic, so page images match the first run.
   * Once the upload is deleted, the saved page images are read instead (without a PDF's text layer).
   */
  private async load(imp: ImportRecord): Promise<IngestedDocument> {
    const dir = `${this.base(imp)}/sources`
    const names = JSON.parse((await this.files.read(`${dir}/names.json`))?.toString('utf8') ?? 'null') as string[] | null
    if (!names) return this.loadPages(imp)
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

  private async loadPages(imp: ImportRecord): Promise<IngestedDocument> {
    const pages: PageImage[] = []
    for (let n = 1; n <= imp.pageCount; n++) {
      const data = await this.files.read(this.pageImage(imp, n))
      if (!data) throw new Error('The uploaded files are missing')
      const [page] = (await ingestBuffer(`page-${n}.png`, data, { maxEdge: this.opts.maxEdge })).pages
      pages.push({ ...page!, pageNumber: n })
    }
    return { fileName: imp.fileName, kind: 'image', pages }
  }

  /** The models to read with: the import's own choice, or for AUTO, the owner's plan. */
  private async planFor(imp: ImportRecord): Promise<ReadingPlan> {
    if (imp.provider !== AUTO) return { primary: { provider: imp.provider, model: imp.model }, fallbacks: [], escalate: null }
    const plan = await this.opts.plan?.(imp.ownerId)
    if (!plan) throw new Error('No AI service with an API key can read pages: add a key in settings, or read the pages with a chat app (manual mode).')
    return plan
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

/** A page with a question the model could not read with confidence. */
export function isDoubtful(page: ExtractedPage): boolean {
  return page.questions.some((q) => q.confidence === 'low')
}

/** `results` with the pages `again` managed to read replaced by those readings. */
function replaceRead(results: PageResult[], again: PageResult[]): PageResult[] {
  const better = new Map(again.filter((r) => r.page).map((r) => [r.pageNumber, r]))
  return results.map((r) => better.get(r.pageNumber) ?? r)
}

/** Extension of an uploaded file for its stored copy; anything odd becomes ".bin". */
function sourceExt(name: string): string {
  const ext = extname(name).toLowerCase()
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext : '.bin'
}
