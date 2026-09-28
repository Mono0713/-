import { ExtractedPage, toStrictJsonSchema, type IngestedDocument, type PageImage } from '@exam/core'
import { systemPrompt, userPrompt } from './prompt.ts'
import { ProviderStopError, type VisionProvider } from './provider.ts'

const PAGE_JSON_SCHEMA = toStrictJsonSchema(ExtractedPage)

export interface PageResult {
  pageNumber: number
  provider: string
  model: string
  page: ExtractedPage | null
  error: string | null
  attempts: number
  usage: { inputTokens: number | null; outputTokens: number | null }
}

export interface PageOptions {
  /** Extra attempts after a reply that is not valid JSON or fails the schema. Default 1. */
  retries?: number
  /** Extra attempts after a rate limit (429) or an overloaded / failing server (5xx). Default 4. */
  busyRetries?: number
  /** Longest single wait before retrying a busy provider. Default 120 s. */
  maxWaitMs?: number
  /** Language the model writes its review notes in, e.g. "en" or "zh-Hant". Default zh-Hant. */
  reviewLanguage?: string
  /** Injected in tests. */
  sleep?: (ms: number) => Promise<void>
}

export interface ExtractOptions extends PageOptions {
  /** Pages sent at the same time. Default 2. */
  concurrency?: number
  /** Only these 1-based page numbers; all pages when omitted. */
  pages?: number[]
  onPage?: (result: PageResult) => void
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Runs one page through a provider and validates the reply against the shared schema. */
export async function extractPage(
  provider: VisionProvider,
  page: PageImage,
  fileName: string,
  opts: PageOptions = {},
): Promise<PageResult> {
  const retries = opts.retries ?? 1
  const busyRetries = opts.busyRetries ?? 4
  const maxWaitMs = opts.maxWaitMs ?? 120_000
  const sleep = opts.sleep ?? defaultSleep

  let lastError = 'no attempt made'
  let usage: PageResult['usage'] = { inputTokens: null, outputTokens: null }
  let model = provider.model
  let invalidReplies = 0
  let busyReplies = 0
  let attempts = 0
  const done = (extracted: ExtractedPage | null): PageResult => ({
    pageNumber: page.pageNumber,
    provider: provider.id,
    model,
    page: extracted,
    error: extracted ? null : lastError,
    attempts,
    usage,
  })

  while (true) {
    attempts++
    try {
      const reply = await provider.complete({
        page,
        system: systemPrompt(opts.reviewLanguage),
        prompt: userPrompt(page, fileName),
        jsonSchema: PAGE_JSON_SCHEMA,
      })
      usage = reply.usage
      model = reply.model
      const parsed = ExtractedPage.safeParse(JSON.parse(reply.text))
      if (parsed.success) return done(parsed.data)
      lastError = `reply did not match the schema: ${parsed.error.message}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (err instanceof ProviderStopError || isClientError(err)) return done(null)
      if (isBusy(err)) {
        if (busyReplies++ >= busyRetries || isHardQuota(lastError)) return done(null)
        await sleep(Math.min(retryDelayMs(lastError) ?? 5_000 * 2 ** (busyReplies - 1), maxWaitMs))
        continue
      }
    }
    if (invalidReplies++ >= retries) return done(null)
  }
}

function statusOf(err: unknown): number | null {
  const status = (err as { status?: unknown } | null)?.status
  return typeof status === 'number' ? status : null
}

/**
 * A 4xx other than 429 (bad key, unknown model, invalid request) fails the same
 * way on every retry. All three SDKs expose the HTTP status as `status`.
 */
function isClientError(err: unknown): boolean {
  const status = statusOf(err)
  return status !== null && status >= 400 && status < 500 && status !== 429
}

/** Rate limited or the provider is overloaded: worth waiting and trying again. */
function isBusy(err: unknown): boolean {
  const status = statusOf(err)
  return status === 429 || (status !== null && status >= 500)
}

/** A quota of zero (e.g. a model not offered on the free tier) never frees up. */
function isHardQuota(message: string): boolean {
  return /limit:\s*0\b/.test(message)
}

/** Reads the provider's suggested wait, e.g. "Please retry in 58.8s" or "retryDelay":"58s". */
export function retryDelayMs(message: string): number | null {
  const match = /retry in ([\d.]+)\s*s/i.exec(message) ?? /"retryDelay"\s*:\s*"([\d.]+)s"/.exec(message)
  return match ? Math.ceil(Number(match[1]) * 1000) : null
}

/** Extracts every page of a document, a few pages at a time, keeping page order. */
export async function extractDocument(
  provider: VisionProvider,
  doc: IngestedDocument,
  opts: ExtractOptions = {},
): Promise<PageResult[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 2)
  const wanted = opts.pages ? new Set(opts.pages) : null
  const pages = doc.pages.filter((p) => !wanted || wanted.has(p.pageNumber))
  const results: PageResult[] = new Array(pages.length)
  let next = 0
  const worker = async () => {
    while (next < pages.length) {
      const index = next++
      const result = await extractPage(provider, pages[index]!, doc.fileName, opts)
      results[index] = result
      opts.onPage?.(result)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, pages.length) }, worker))
  return results
}
