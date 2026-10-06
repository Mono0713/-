import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'

/** A model that answers a text prompt with JSON. Each provider is a few lines; add one with `registerTextModel`. */
export interface TextModel {
  provider: string
  model: string
  /** Returns the reply's text; the caller parses and validates it. `images` are PNGs shown before the prompt. */
  complete(system: string, prompt: string, images?: Buffer[]): Promise<string>
}

export interface TextModelConfig {
  apiKey: string
  model: string
  /** An OpenAI-compatible service at this address instead of the provider's own API. */
  baseUrl?: string
  /** Told the tokens of every call, e.g. to keep a usage log. */
  onUsage?: (usage: { inputTokens: number | null; outputTokens: number | null }) => void
}

type Factory = (config: TextModelConfig) => TextModel

const factories = new Map<string, Factory>([
  [
    'claude',
    ({ apiKey, model, onUsage }) => ({
      provider: 'claude',
      model,
      async complete(system, prompt, images = []) {
        const content: Anthropic.ContentBlockParam[] = [
          ...images.map((png) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png' as const, data: png.toString('base64') } })),
          { type: 'text', text: prompt },
        ]
        const message = await new Anthropic({ apiKey }).messages.create({ model, max_tokens: 16000, system, messages: [{ role: 'user', content }] })
        onUsage?.({ inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens })
        return message.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
      },
    }),
  ],
  [
    'openai',
    ({ apiKey, model, onUsage }) => ({
      provider: 'openai',
      model,
      async complete(system, prompt, images = []) {
        const response = await new OpenAI({ apiKey }).responses.create({
          model,
          instructions: system,
          input: [
            {
              role: 'user',
              content: [
                ...images.map((png) => ({ type: 'input_image' as const, image_url: `data:image/png;base64,${png.toString('base64')}`, detail: 'high' as const })),
                { type: 'input_text' as const, text: prompt },
              ],
            },
          ],
        })
        onUsage?.({ inputTokens: response.usage?.input_tokens ?? null, outputTokens: response.usage?.output_tokens ?? null })
        return response.output_text
      },
    }),
  ],
  [
    'gemini',
    ({ apiKey, model, onUsage }) => ({
      provider: 'gemini',
      model,
      async complete(system, prompt, images = []) {
        const response = await new GoogleGenAI({ apiKey }).models.generateContent({
          model,
          contents: [{ role: 'user', parts: [...images.map((png) => ({ inlineData: { mimeType: 'image/png', data: png.toString('base64') } })), { text: prompt }] }],
          config: { systemInstruction: system, responseMimeType: 'application/json' },
        })
        onUsage?.({ inputTokens: response.usageMetadata?.promptTokenCount ?? null, outputTokens: response.usageMetadata?.candidatesTokenCount ?? null })
        return response.text ?? ''
      },
    }),
  ],
])

export function registerTextModel(provider: string, factory: Factory): void {
  factories.set(provider, factory)
}

/** Any OpenAI-compatible service (OpenRouter, DeepSeek, Groq, Ollama, …) through Chat Completions. */
function compatible(provider: string, { apiKey, model, baseUrl, onUsage }: TextModelConfig): TextModel {
  return {
    provider,
    model,
    async complete(system, prompt, images = []) {
      const response = await new OpenAI({ apiKey: apiKey || 'none', baseURL: baseUrl }).chat.completions.create({
        model,
        // Left unset, many services stop at 4,096 tokens.
        max_tokens: 8_192,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [...images.map((png) => ({ type: 'image_url' as const, image_url: { url: `data:image/png;base64,${png.toString('base64')}` } })), { type: 'text' as const, text: prompt }],
          },
        ],
      })
      onUsage?.({ inputTokens: response.usage?.prompt_tokens ?? null, outputTokens: response.usage?.completion_tokens ?? null })
      if (!Array.isArray(response?.choices)) throw new Error(`${provider} did not answer like an OpenAI-compatible API (no "choices"). Check the API address: it usually ends in /v1.`)
      return response.choices[0]?.message.content ?? ''
    },
  }
}

export function createTextModel(provider: string, config: TextModelConfig): TextModel {
  if (config.baseUrl) return compatible(provider, config)
  const factory = factories.get(provider)
  if (!factory) throw new Error(`No text model for provider "${provider}"`)
  return factory(config)
}
