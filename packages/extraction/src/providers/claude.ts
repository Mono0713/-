import Anthropic from '@anthropic-ai/sdk'
import { ProviderStopError, toBase64, type PageRequest, type ProviderReply, type VisionProvider } from '../provider.ts'

export const CLAUDE_DEFAULT_MODEL = 'claude-opus-5'

export interface ClaudeOptions {
  apiKey?: string
  model?: string
  /** Reasoning effort. Transcription rarely needs deep reasoning; "medium" keeps cost down. */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  client?: Anthropic
}

export class ClaudeProvider implements VisionProvider {
  readonly id = 'claude'
  readonly model: string
  private readonly client: Anthropic
  private readonly effort: NonNullable<ClaudeOptions['effort']>

  constructor(opts: ClaudeOptions = {}) {
    this.model = opts.model ?? CLAUDE_DEFAULT_MODEL
    this.effort = opts.effort ?? 'medium'
    this.client = opts.client ?? new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {})
  }

  async complete(req: PageRequest): Promise<ProviderReply> {
    // Haiku 4.5 takes neither adaptive thinking nor effort; it reads the page without them.
    const small = /haiku/.test(this.model)
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: small ? 32000 : 64000,
      ...(small ? {} : { thinking: { type: 'adaptive' as const } }),
      output_config: { ...(small ? {} : { effort: this.effort }), format: { type: 'json_schema', schema: req.jsonSchema } },
      // The instructions are the same for every page; cached, later pages read them at a tenth of the price.
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: req.page.mimeType, data: toBase64(req.page) } },
            { type: 'text', text: req.prompt },
          ],
        },
      ],
    })
    const message = await stream.finalMessage()

    if (message.stop_reason === 'refusal' || message.stop_reason === 'max_tokens') {
      throw new ProviderStopError(this.id, message.stop_reason, `Claude stopped with "${message.stop_reason}"`)
    }
    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
    return {
      text,
      model: message.model,
      usage: { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens },
    }
  }
}
