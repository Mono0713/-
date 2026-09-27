import { GoogleGenAI } from '@google/genai'
import { ProviderStopError, toBase64, type PageRequest, type ProviderReply, type VisionProvider } from '../provider.ts'

export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-pro'

export interface GeminiOptions {
  apiKey?: string
  model?: string
  client?: GoogleGenAI
}

export class GeminiProvider implements VisionProvider {
  readonly id = 'gemini'
  readonly model: string
  private readonly client: GoogleGenAI

  constructor(opts: GeminiOptions = {}) {
    this.model = opts.model ?? GEMINI_DEFAULT_MODEL
    const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY
    this.client = opts.client ?? new GoogleGenAI(apiKey ? { apiKey } : {})
  }

  async complete(req: PageRequest): Promise<ProviderReply> {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: 'user',
          parts: [{ inlineData: { mimeType: req.page.mimeType, data: toBase64(req.page) } }, { text: req.prompt }],
        },
      ],
      config: {
        systemInstruction: req.system,
        responseMimeType: 'application/json',
        responseJsonSchema: req.jsonSchema,
      },
    })

    const finish = response.candidates?.[0]?.finishReason
    if (finish && finish !== 'STOP') {
      throw new ProviderStopError(this.id, String(finish), `Gemini stopped with "${finish}"`)
    }
    const text = response.text
    if (!text) throw new ProviderStopError(this.id, 'empty', 'Gemini returned no text')
    return {
      text,
      model: response.modelVersion ?? this.model,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? null,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? null,
      },
    }
  }
}
