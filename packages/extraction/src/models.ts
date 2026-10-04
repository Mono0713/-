import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'
import { BUILTIN_MODELS, type Tier } from '@exam/models'
import { CLAUDE_DEFAULT_MODEL } from './providers/claude.ts'
import { GEMINI_DEFAULT_MODEL } from './providers/gemini.ts'
import { OPENAI_DEFAULT_MODEL } from './providers/openai.ts'

export type { Tier as ModelTier } from '@exam/models'

export interface ModelChoice {
  id: string
  label: string
  tier: Tier
}

/** Well-known vision models per provider, from @exam/models, offered in pickers before any API call. */
export const MODEL_CATALOG: Record<string, ModelChoice[]> = Object.fromEntries(
  Object.entries(BUILTIN_MODELS).map(([id, models]) => [id, models.map(({ id, label, tier }) => ({ id, label, tier }))]),
)

/** The model a provider uses when none is chosen (before any <ID>_MODEL override). */
export const DEFAULT_MODELS: Record<string, string> = {
  claude: CLAUDE_DEFAULT_MODEL,
  openai: OPENAI_DEFAULT_MODEL,
  gemini: GEMINI_DEFAULT_MODEL,
}

// Model families that cannot read an exam page (speech, images out, embeddings, …).
const NOT_VISION_CHAT = /audio|realtime|tts|transcribe|embedding|image|search|moderation|whisper|dall-e|davinci|babbage|codex/

/**
 * Asks the provider's API which models this key can use, newest first where the API says.
 * With a base URL, the provider is any OpenAI-compatible service and lists everything it serves.
 */
export async function listModels(providerId: string, apiKey: string, baseUrl?: string): Promise<string[]> {
  if (baseUrl) {
    const ids: string[] = []
    for await (const m of new OpenAI({ apiKey, baseURL: baseUrl }).models.list()) ids.push(m.id)
    return ids.sort()
  }
  switch (providerId) {
    case 'claude': {
      const ids: string[] = []
      for await (const m of new Anthropic({ apiKey }).models.list({ limit: 100 })) ids.push(m.id)
      return ids
    }
    case 'openai': {
      const ids: string[] = []
      for await (const m of new OpenAI({ apiKey }).models.list()) if (/^(gpt-|o\d)/.test(m.id) && !NOT_VISION_CHAT.test(m.id)) ids.push(m.id)
      return ids.sort().reverse()
    }
    case 'gemini': {
      const ids: string[] = []
      for await (const m of await new GoogleGenAI({ apiKey }).models.list()) {
        const id = m.name?.replace(/^models\//, '')
        if (id?.startsWith('gemini') && m.supportedActions?.includes('generateContent') && !NOT_VISION_CHAT.test(id)) ids.push(id)
      }
      return ids.sort().reverse()
    }
    default:
      return []
  }
}
