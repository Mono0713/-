import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ProviderStopError, type PageRequest, type ProviderReply, type VisionProvider } from '../provider.ts'
import { typeNotation } from '../type-notation.ts'

/** Where the prompts and pasted replies are kept, by file name. */
export interface TextFiles {
  read(name: string): Promise<string | null>
  write(name: string, text: string): Promise<void>
}

/** Prompt and reply files in a folder on disk (the CLI's way). */
export function folderFiles(dir: string): TextFiles {
  return {
    read: async (name) => readFile(join(dir, name), 'utf8').catch((err: NodeJS.ErrnoException) => {
      if (err.code === 'ENOENT') return null
      throw err
    }),
    write: async (name, text) => {
      await mkdir(dir, { recursive: true })
      await writeFile(join(dir, name), text)
    },
  }
}

export interface ManualOptions {
  /** Folder that holds the prompts to copy and the replies pasted back. */
  workDir?: string
  /** Somewhere else to keep them, e.g. the web app's file store. Used instead of workDir. */
  files?: TextFiles
  /** Free-form label for where the replies came from, e.g. "claude-web". */
  model?: string
}

/**
 * Lets a person run the extraction through a chat app (claude.ai, the Gemini
 * app, ChatGPT) instead of an API. The first run writes one prompt file per
 * page; the person sends it with the page image and saves the reply next to
 * it; the next run reads those replies and validates them like any other
 * provider's. Several pages can also go in one message: the CLI writes
 * batch.prompt.md for all waiting pages and one reply, batch.reply.json,
 * answers them together.
 */
export class ManualProvider implements VisionProvider {
  readonly id = 'manual'
  readonly model: string
  private readonly workDir: string | null
  private readonly files: TextFiles
  private readonly pending: PageRequest[] = []

  constructor(opts: ManualOptions) {
    if (!opts.files && !opts.workDir) throw new Error('The manual provider needs a workDir or files')
    this.workDir = opts.files ? null : opts.workDir!
    this.files = opts.files ?? folderFiles(opts.workDir!)
    this.model = opts.model ?? 'chat'
  }

  /** Where a file is, for messages to the person: a path when it is in a folder, else its name. */
  private where(name: string): string {
    return this.workDir ? join(this.workDir, name) : name
  }

  replyPath(pageNumber: number): string {
    return this.where(replyName(pageNumber))
  }

  promptPath(pageNumber: number): string {
    return this.where(promptName(pageNumber))
  }

  get batchPromptPath(): string {
    return this.where(BATCH_PROMPT)
  }

  get batchReplyPath(): string {
    return this.where(BATCH_REPLY)
  }

  /** The prompt written for a page, or null when none has been written. */
  readPrompt(pageNumber: number): Promise<string | null> {
    return this.files.read(promptName(pageNumber))
  }

  /** The prompt covering several waiting pages, if one was written. */
  readBatchPrompt(): Promise<string | null> {
    return this.files.read(BATCH_PROMPT)
  }

  /** Saves a reply pasted from a chat app, for one page or ("batch") for the batch prompt. */
  writeReply(target: number | 'batch', text: string): Promise<void> {
    return this.files.write(target === 'batch' ? BATCH_REPLY : replyName(target), text)
  }

  async complete(req: PageRequest): Promise<ProviderReply> {
    const n = req.page.pageNumber
    const saved = await this.files.read(replyName(n))
    if (saved !== null) {
      const text = extractJson(saved)
      if (text) return this.reply(text)
    }
    const fromBatch = await this.readBatchReply(n)
    if (fromBatch) return this.reply(fromBatch)

    await this.files.write(promptName(n), chatPrompt(req))
    this.pending.push(req)
    throw new ProviderStopError(
      this.id,
      'waiting',
      `waiting for a reply: send ${this.promptPath(n)} with pages/page-${n}.png to a chat app, save its JSON reply as ${this.replyPath(n)}`,
    )
  }

  /**
   * Writes one prompt covering every page still waiting for a reply, so they
   * can be sent in a single chat message. Returns the pages it covers, in the
   * order their images must be attached.
   */
  async writeBatchPrompt(): Promise<number[]> {
    const requests = [...this.pending].sort((a, b) => a.page.pageNumber - b.page.pageNumber)
    if (requests.length < 2) return []
    await this.files.write(BATCH_PROMPT, batchChatPrompt(requests))
    return requests.map((r) => r.page.pageNumber)
  }

  private reply(text: string): ProviderReply {
    return { text, model: this.model, usage: { inputTokens: null, outputTokens: null } }
  }

  /** The page's entry from batch.reply.json as JSON text, or null when there is none. */
  private async readBatchReply(pageNumber: number): Promise<string | null> {
    const saved = await this.files.read(BATCH_REPLY)
    if (saved === null) return null
    const text = extractJson(saved)
    let parsed: unknown
    try {
      parsed = JSON.parse(text ?? '')
    } catch {
      throw new ProviderStopError(this.id, 'invalid', `${this.batchReplyPath} is not valid JSON`)
    }
    const pages = (parsed as { pages?: { pageNumber?: unknown; result?: unknown }[] } | null)?.pages
    const entry = Array.isArray(pages) ? pages.find((p) => Number(p?.pageNumber) === pageNumber) : undefined
    return entry?.result ? JSON.stringify(entry.result) : null
  }
}

const promptName = (n: number) => `page-${n}.prompt.md`
const replyName = (n: number) => `page-${n}.reply.json`
const BATCH_PROMPT = 'batch.prompt.md'
const BATCH_REPLY = 'batch.reply.json'

/** One message to paste into a chat app. Chat apps do not enforce a schema, so it is spelled out. */
export function chatPrompt(req: PageRequest): string {
  return [
    req.system,
    '',
    req.prompt,
    '',
    'Reply with a single JSON object of type Page and nothing else (no explanation, no Markdown fence).',
    REPLY_RULES,
    '',
    typeNotation(req.jsonSchema, 'Page'),
    '',
  ].join('\n')
}

const REPLY_RULES =
  'Every field is required: use null where the type allows it and the value is unknown, and [] for empty lists. // comments explain a field and are not part of the JSON.'

/** One message covering several pages; the reply wraps each page's result with its page number. */
export function batchChatPrompt(requests: PageRequest[]): string {
  const first = requests[0]!
  const numbers = requests.map((r) => r.page.pageNumber)
  const lines = [
    first.system,
    '',
    `You receive ${requests.length} page images of the same exam, attached in this order: ${numbers.map((n) => `page ${n}`).join(', ')}.`,
    'Handle each page on its own, exactly as you would for a single page, and return one entry per page in "pages" with its page number and its result.',
    'A question cut at the bottom of one page and continued on the next stays split: mark continuesOnNextPage / continuesFromPreviousPage instead of joining it.',
  ]
  for (const req of requests) {
    if (req.page.textLayer) {
      lines.push('', `Embedded PDF text layer of page ${req.page.pageNumber} (check spelling with it, trust the image for layout and math):`, '<text_layer>', req.page.textLayer, '</text_layer>')
    }
  }
  lines.push(
    '',
    `Reply with a single JSON object and nothing else (no explanation, no Markdown fence): { "pages": [{ "pageNumber": ${numbers[0]}, "result": Page }, ...] }, one entry per page, where each result has type Page.`,
    REPLY_RULES,
    '',
    typeNotation(first.jsonSchema, 'Page'),
    '',
  )
  return lines.join('\n')
}

/** Pulls the JSON object out of a pasted reply that may be wrapped in a code fence or chatter. */
export function extractJson(reply: string): string | null {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  return start >= 0 && end > start ? reply.slice(start, end + 1) : null
}
