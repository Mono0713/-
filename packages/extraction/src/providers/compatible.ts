import OpenAI from 'openai'
import { withOptionalEmpties } from '@exam/core'
import { schemaInstructions } from '../prompt.ts'
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
/**
 * Services (address + model) known to need the schema in the prompt. Kept for the life of the
 * server, so only the first import after a restart can pay for an off-schema reply.
 */
const schemaInPromptServices = new Set<string>()

export class OpenAICompatibleProvider implements VisionProvider {
  readonly id: string
  readonly model: string
  private readonly client: OpenAI
  private readonly serviceKey: string
  private schemaInPrompt: boolean
  /** Services that leave it unset often stop at 4,096 tokens, which a full exam page passes. */
  private maxTokens = 32_000

  constructor(opts: CompatibleOptions) {
    if (!opts.model) throw new Error(`Choose a model for ${opts.id}`)
    this.id = opts.id
    this.model = opts.model
    this.client = opts.client ?? new OpenAI({ apiKey: opts.apiKey || 'none', baseURL: opts.baseUrl })
    this.serviceKey = `${opts.baseUrl}|${opts.model}`
    // Relays in front of Claude accept a strict schema without applying it; skip the wasted first reply.
    this.schemaInPrompt = schemaInPromptServices.has(this.serviceKey) || /claude/i.test(opts.model)
  }

  private useSchemaInPrompt(): void {
    this.schemaInPrompt = true
    schemaInPromptServices.add(this.serviceKey)
  }

  /**
   * Some services (relays in front of Claude, for one) take the strict JSON Schema without
   * applying it, so the model never sees it; after one off-schema reply it goes into the prompt.
   */
  invalidReply(): void {
    this.useSchemaInPrompt()
  }

  async complete(req: PageRequest): Promise<ProviderReply> {
    for (;;) {
      try {
        return await this.send(req)
      } catch (err) {
        if (!this.schemaInPrompt && rejectsSchema(err)) this.useSchemaInPrompt()
        else if (this.maxTokens > 8_192 && rejectsMaxTokens(err)) this.maxTokens = 8_192
        else throw err
      }
    }
  }

  private async send(req: PageRequest): Promise<ProviderReply> {
    // The schema joins the system text, which is the same for every page, so services that cache prompts reuse it.
    const system = this.schemaInPrompt ? `${req.system}\n\n${schemaInstructions(looseSchema(req.jsonSchema))}` : req.system
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${req.page.mimeType};base64,${toBase64(req.page)}`, detail: 'high' } },
            { type: 'text', text: req.prompt },
          ],
        },
      ],
      response_format: this.schemaInPrompt
        ? { type: 'json_object' }
        : { type: 'json_schema', json_schema: { name: 'extracted_page', schema: req.jsonSchema, strict: true } },
    })
    // A web page instead of an API (a wrong address) still answers 200, with no choices in it.
    if (!Array.isArray(response?.choices)) throw new ProviderStopError(this.id, 'empty', `${this.id} did not answer like an OpenAI-compatible API (no "choices"). Check the API address: it usually ends in /v1.`)
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

const looseSchemas = new WeakMap<object, { [key: string]: unknown }>()

/** The schema with empty fields optional, made once per schema object. */
function looseSchema(schema: { [key: string]: unknown }): { [key: string]: unknown } {
  let loose = looseSchemas.get(schema)
  if (!loose) looseSchemas.set(schema, (loose = withOptionalEmpties(schema)))
  return loose
}

/** A 400 or 422 about the response format: the service does not take a strict JSON Schema. */
function rejectsSchema(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status
  const message = err instanceof Error ? err.message : ''
  return (status === 400 || status === 422) && /response_format|json_schema|schema|structured/i.test(message)
}

/** A 400 saying the model can't write that many tokens. */
function rejectsMaxTokens(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status
  const message = err instanceof Error ? err.message : ''
  return status === 400 && /max_tokens|max_completion_tokens|maximum.*tokens|output tokens/i.test(message)
}

/** Some services wrap JSON in a Markdown fence even when asked not to. */
function stripFence(text: string): string {
  const match = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/.exec(text)
  return match ? match[1]! : text
}
