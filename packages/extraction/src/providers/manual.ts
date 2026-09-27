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
 * provider's.
 */
export class ManualProvider implements VisionProvider {
  readonly id = 'manual'
  readonly model: string
  private readonly workDir: string

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

  async complete(req: PageRequest): Promise<ProviderReply> {
    const n = req.page.pageNumber
    const replyPath = this.replyPath(n)
    if (existsSync(replyPath)) {
      const text = extractJson(await readFile(replyPath, 'utf8'))
      if (text) return { text, model: this.model, usage: { inputTokens: null, outputTokens: null } }
    }
    await mkdir(this.workDir, { recursive: true })
    await writeFile(this.promptPath(n), chatPrompt(req))
    throw new ProviderStopError(
      this.id,
      'waiting',
      `waiting for a reply: send ${this.promptPath(n)} with pages/page-${n}.png to a chat app, save its JSON reply as ${replyPath}`,
    )
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

/** Pulls the JSON object out of a pasted reply that may be wrapped in a code fence or chatter. */
export function extractJson(reply: string): string | null {
  const start = reply.indexOf('{')
  const end = reply.lastIndexOf('}')
  return start >= 0 && end > start ? reply.slice(start, end + 1) : null
}
