import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ProviderStopError, type PageRequest, type ProviderReply, type VisionProvider } from '../provider.ts'

export interface ManualOptions {
  /** Folder that holds the prompts to copy and the replies pasted back. */
  workDir: string
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
  private readonly workDir: string
  private readonly pending: PageRequest[] = []

  constructor(opts: ManualOptions) {
    this.workDir = opts.workDir
    this.model = opts.model ?? 'chat'
  }

  replyPath(pageNumber: number): string {
    return join(this.workDir, `page-${pageNumber}.reply.json`)
  }

  promptPath(pageNumber: number): string {
    return join(this.workDir, `page-${pageNumber}.prompt.md`)
  }

  get batchPromptPath(): string {
    return join(this.workDir, 'batch.prompt.md')
  }

  get batchReplyPath(): string {
    return join(this.workDir, 'batch.reply.json')
  }

  async complete(req: PageRequest): Promise<ProviderReply> {
    const n = req.page.pageNumber
    const replyPath = this.replyPath(n)
    if (existsSync(replyPath)) {
      const text = extractJson(await readFile(replyPath, 'utf8'))
      if (text) return this.reply(text)
    }
    const fromBatch = await this.readBatchReply(n)
    if (fromBatch) return this.reply(fromBatch)

    await mkdir(this.workDir, { recursive: true })
    await writeFile(this.promptPath(n), chatPrompt(req))
    this.pending.push(req)
    throw new ProviderStopError(
      this.id,
      'waiting',
      `waiting for a reply: send ${this.promptPath(n)} with pages/page-${n}.png to a chat app, save its JSON reply as ${replyPath}`,
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
    await writeFile(this.batchPromptPath, batchChatPrompt(requests))
    return requests.map((r) => r.page.pageNumber)
  }

  private reply(text: string): ProviderReply {
    return { text, model: this.model, usage: { inputTokens: null, outputTokens: null } }
  }

  /** The page's entry from batch.reply.json as JSON text, or null when there is none. */
  private async readBatchReply(pageNumber: number): Promise<string | null> {
    if (!existsSync(this.batchReplyPath)) return null
    const text = extractJson(await readFile(this.batchReplyPath, 'utf8'))
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

/** One message to paste into a chat app. Chat apps do not enforce a schema, so it is spelled out. */
export function chatPrompt(req: PageRequest): string {
  return [
    req.system,
    '',
    req.prompt,
    '',
    'Reply with a single JSON object and nothing else (no explanation, no Markdown fence). It must match this JSON Schema exactly; every property is required and uses null when unknown:',
    '',
    JSON.stringify(req.jsonSchema),
    '',
  ].join('\n')
}

/** One message covering several pages; the reply wraps each page's result with its page number. */
export function batchChatPrompt(requests: PageRequest[]): string {
  const first = requests[0]!
  const numbers = requests.map((r) => r.page.pageNumber)
  const schema = {
    type: 'object',
    properties: {
      pages: {
        type: 'array',
        items: {
          type: 'object',
          properties: { pageNumber: { type: 'integer' }, result: first.jsonSchema },
          required: ['pageNumber', 'result'],
          additionalProperties: false,
        },
      },
    },
    required: ['pages'],
    additionalProperties: false,
  }
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
    'Reply with a single JSON object and nothing else (no explanation, no Markdown fence). It must match this JSON Schema exactly; every property is required and uses null when unknown:',
    '',
    JSON.stringify(schema),
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
