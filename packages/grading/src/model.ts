import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'

/** A model that answers a text prompt with JSON. Each provider is a few lines; add one with `registerTextModel`. */
export interface TextModel {
  provider: string
  model: string
  /** Returns the reply's text; the caller parses and validates it. */
  complete(system: string, prompt: string): Promise<string>
}

type Factory = (config: { apiKey: string; model: string }) => TextModel

const factories = new Map<string, Factory>([
  [
    'claude',
    ({ apiKey, model }) => ({
      provider: 'claude',
      model,
      async complete(system, prompt) {
        const message = await new Anthropic({ apiKey }).messages.create({ model, max_tokens: 16000, system, messages: [{ role: 'user', content: prompt }] })
        return message.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
      },
    }),
  ],
  [
    'openai',
    ({ apiKey, model }) => ({
      provider: 'openai',
      model,
      async complete(system, prompt) {
        const response = await new OpenAI({ apiKey }).responses.create({ model, instructions: system, input: prompt })
        return response.output_text
      },
    }),
  ],
  [
    'gemini',
    ({ apiKey, model }) => ({
      provider: 'gemini',
      model,
      async complete(system, prompt) {
        const response = await new GoogleGenAI({ apiKey }).models.generateContent({
          model,
          contents: prompt,
          config: { systemInstruction: system, responseMimeType: 'application/json' },
        })
        return response.text ?? ''
      },
    }),
  ],
])

export function registerTextModel(provider: string, factory: Factory): void {
  factories.set(provider, factory)
}

export function createTextModel(provider: string, config: { apiKey: string; model: string }): TextModel {
  const factory = factories.get(provider)
  if (!factory) throw new Error(`No text model for provider "${provider}"`)
  return factory(config)
}
