import OpenAI from 'openai'
import { ProviderStopError, toBase64, type PageRequest, type ProviderReply, type VisionProvider } from '../provider.ts'

export interface CompatibleOptions {
  /** The provider's id in the app, e.g. "c-openrouter". */
  id: string
  baseUrl: string
  apiKey?: string
  model?: string
  client?: OpenAI
}

/**
 * Any service that speaks the OpenAI Chat Completions format: OpenRouter, DeepSeek, Groq,
 * Mistral, xAI, Qwen, a local Ollama or LM Studio, and many more. Not every one supports a
 * strict JSON Schema; when one rejects it, the schema goes into the prompt instead and the
 * reply is validated the same way afterwards.
 */
export class OpenAICompatibleProvider implements VisionProvider {
  readonly id: string
  readonly model: string
  private readonly client: OpenAI
  private schemaInPrompt = false

  constructor(opts: CompatibleOptions) {
    if (!opts.model) throw new Error(`Choose a model for ${opts.id}`)
    this.id = opts.id
    this.model = opts.model
    this.client = opts.client ?? new OpenAI({ apiKey: opts.apiKey || 'none', baseURL: opts.baseUrl })
  }

  async complete(req: PageRequest): Promise<ProviderReply> {
    try {
      return await this.send(req)
    } catch (err) {
      if (this.schemaInPrompt || !rejectsSchema(err)) throw err
      this.schemaInPrompt = true
      return this.send(req)
    }
  }

  private async send(req: PageRequest): Promise<ProviderReply> {
    const prompt = this.schemaInPrompt ? `${req.prompt}\n\nReply with one JSON object only, matching this JSON Schema:\n${JSON.stringify(req.jsonSchema)}` : req.prompt
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: req.system },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${req.page.mimeType};base64,${toBase64(req.page)}`, detail: 'high' } },
            { type: 'text', text: prompt },
          ],
        },
      ],
      response_format: this.schemaInPrompt
        ? { type: 'json_object' }
        : { type: 'json_schema', json_schema: { name: 'extracted_page', schema: req.jsonSchema, strict: true } },
    })
    const choice = response.choices[0]
    if (!choice) throw new ProviderStopError(this.id, 'empty', `${this.id} returned no reply`)
    if (choice.message.refusal) throw new ProviderStopError(this.id, 'refusal', `${this.id} refused: ${choice.message.refusal}`)
    if (choice.finish_reason === 'length' || choice.finish_reason === 'content_filter') {
      throw new ProviderStopError(this.id, choice.finish_reason, `${this.id} stopped with "${choice.finish_reason}"`)
    }
    return {
      text: stripFence(choice.message.content ?? ''),
      model: response.model || this.model,
      usage: { inputTokens: response.usage?.prompt_tokens ?? null, outputTokens: response.usage?.completion_tokens ?? null },
    }
  }
}

/** A 400 or 422 about the response format: the service does not take a strict JSON Schema. */
function rejectsSchema(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status
  const message = err instanceof Error ? err.message : ''
  return (status === 400 || status === 422) && /response_format|json_schema|schema|structured/i.test(message)
}

/** Some services wrap JSON in a Markdown fence even when asked not to. */
function stripFence(text: string): string {
  const match = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(text)
  return match ? match[1]! : text
}
