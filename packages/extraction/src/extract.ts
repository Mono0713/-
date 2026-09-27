import { ExtractedPage, toStrictJsonSchema, type IngestedDocument, type PageImage } from '@exam/core'
import { SYSTEM_PROMPT, userPrompt } from './prompt.ts'
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

export interface ExtractOptions {
  /** Extra attempts after a reply that fails validation or a transient error. Default 1. */
  retries?: number
  /** Pages sent at the same time. Default 2. */
  concurrency?: number
  onPage?: (result: PageResult) => void
}

/** Runs one page through a provider and validates the reply against the shared schema. */
export async function extractPage(
  provider: VisionProvider,
  page: PageImage,
  fileName: string,
  retries = 1,
): Promise<PageResult> {
  let lastError = 'no attempt made'
  let usage: PageResult['usage'] = { inputTokens: null, outputTokens: null }
  let model = provider.model
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const reply = await provider.complete({
        page,
        system: SYSTEM_PROMPT,
        prompt: userPrompt(page, fileName),
        jsonSchema: PAGE_JSON_SCHEMA,
      })
      usage = reply.usage
      model = reply.model
      const parsed = ExtractedPage.safeParse(JSON.parse(reply.text))
      if (parsed.success) {
        return { pageNumber: page.pageNumber, provider: provider.id, model, page: parsed.data, error: null, attempts: attempt, usage }
      }
      lastError = `reply did not match the schema: ${parsed.error.message}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      if (err instanceof ProviderStopError || isClientError(err)) {
        return { pageNumber: page.pageNumber, provider: provider.id, model, page: null, error: lastError, attempts: attempt, usage }
      }
    }
  }
  return { pageNumber: page.pageNumber, provider: provider.id, model, page: null, error: lastError, attempts: retries + 1, usage }
}

/**
 * A 4xx other than 429 (bad key, unknown model, invalid request) fails the same
 * way on every retry. All three SDKs expose the HTTP status as `status`.
 */
function isClientError(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 429
}

/** Extracts every page of a document, a few pages at a time, keeping page order. */
export async function extractDocument(
  provider: VisionProvider,
  doc: IngestedDocument,
  opts: ExtractOptions = {},
): Promise<PageResult[]> {
  const concurrency = Math.max(1, opts.concurrency ?? 2)
  const results: PageResult[] = new Array(doc.pages.length)
  let next = 0
  const worker = async () => {
    while (next < doc.pages.length) {
      const index = next++
      const result = await extractPage(provider, doc.pages[index]!, doc.fileName, opts.retries ?? 1)
      results[index] = result
      opts.onPage?.(result)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, doc.pages.length) }, worker))
  return results
}
