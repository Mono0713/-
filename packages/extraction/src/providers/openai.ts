import OpenAI from 'openai'
import { ProviderStopError, toBase64, type PageRequest, type ProviderReply, type VisionProvider } from '../provider.ts'

export const OPENAI_DEFAULT_MODEL = 'gpt-5'

export interface OpenAIOptions {
  apiKey?: string
  model?: string
  client?: OpenAI
}

export class OpenAIProvider implements VisionProvider {
  readonly id = 'openai'
  readonly model: string
  private readonly client: OpenAI

  constructor(opts: OpenAIOptions = {}) {
    this.model = opts.model ?? OPENAI_DEFAULT_MODEL
    this.client = opts.client ?? new OpenAI(opts.apiKey ? { apiKey: opts.apiKey } : {})
  }

  async complete(req: PageRequest): Promise<ProviderReply> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: req.system,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_image',
              image_url: `data:${req.page.mimeType};base64,${toBase64(req.page)}`,
              detail: 'high',
            },
            { type: 'input_text', text: req.prompt },
          ],
        },
      ],
      text: { format: { type: 'json_schema', name: 'extracted_page', schema: req.jsonSchema, strict: true } },
    })

    if (response.status === 'incomplete') {
      const reason = response.incomplete_details?.reason ?? 'incomplete'
      throw new ProviderStopError(this.id, reason, `OpenAI response incomplete: ${reason}`)
    }
    const refusal = response.output
      .flatMap((item) => (item.type === 'message' ? item.content : []))
      .find((part) => part.type === 'refusal')
    if (refusal) throw new ProviderStopError(this.id, 'refusal', `OpenAI refused: ${refusal.refusal}`)

    return {
      text: response.output_text,
      model: response.model,
      usage: {
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
      },
    }
  }
}
