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

type Factory = (config: { apiKey: string; model: string }) => TextModel

const factories = new Map<string, Factory>([
  [
    'claude',
    ({ apiKey, model }) => ({
      provider: 'claude',
      model,
      async complete(system, prompt, images = []) {
        const content: Anthropic.ContentBlockParam[] = [
          ...images.map((png) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png' as const, data: png.toString('base64') } })),
          { type: 'text', text: prompt },
        ]
        const message = await new Anthropic({ apiKey }).messages.create({ model, max_tokens: 16000, system, messages: [{ role: 'user', content }] })
        return message.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
      },
    }),
  ],
  [
    'openai',
    ({ apiKey, model }) => ({
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
        return response.output_text
      },
    }),
  ],
  [
    'gemini',
    ({ apiKey, model }) => ({
      provider: 'gemini',
      model,
      async complete(system, prompt, images = []) {
        const response = await new GoogleGenAI({ apiKey }).models.generateContent({
          model,
          contents: [{ role: 'user', parts: [...images.map((png) => ({ inlineData: { mimeType: 'image/png', data: png.toString('base64') } })), { text: prompt }] }],
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
