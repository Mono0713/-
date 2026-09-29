import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenAI } from '@google/genai'
import OpenAI from 'openai'
import { CLAUDE_DEFAULT_MODEL } from './providers/claude.ts'
import { GEMINI_DEFAULT_MODEL } from './providers/gemini.ts'
import { OPENAI_DEFAULT_MODEL } from './providers/openai.ts'

/** best: most accurate on handwriting and dense layouts; balanced; fast: cheapest. */
export type ModelTier = 'best' | 'balanced' | 'fast'

export interface ModelChoice {
  id: string
  label: string
  tier: ModelTier
}

/**
 * Well-known vision models per provider, offered in pickers before any API call.
 * Providers retire models over time: `listModels` asks the API for what it serves now,
 * and a picker always lets people type an id that is not listed.
 */
export const MODEL_CATALOG: Record<string, ModelChoice[]> = {
  claude: [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', tier: 'best' },
    { id: 'claude-opus-5', label: 'Claude Opus 5', tier: 'best' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', tier: 'balanced' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', tier: 'fast' },
  ],
  openai: [
    { id: 'gpt-5', label: 'GPT-5', tier: 'best' },
    { id: 'gpt-5-mini', label: 'GPT-5 mini', tier: 'balanced' },
    { id: 'gpt-5-nano', label: 'GPT-5 nano', tier: 'fast' },
  ],
  gemini: [
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)', tier: 'best' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', tier: 'balanced' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tier: 'fast' },
  ],
}

/** The model a provider uses when none is chosen (before any <ID>_MODEL override). */
export const DEFAULT_MODELS: Record<string, string> = {
  claude: CLAUDE_DEFAULT_MODEL,
  openai: OPENAI_DEFAULT_MODEL,
  gemini: GEMINI_DEFAULT_MODEL,
}

// Model families that cannot read an exam page (speech, images out, embeddings, …).
const NOT_VISION_CHAT = /audio|realtime|tts|transcribe|embedding|image|search|moderation|whisper|dall-e|davinci|babbage|codex/

/** Asks the provider's API which models this key can use, newest first where the API says. */
export async function listModels(providerId: string, apiKey: string): Promise<string[]> {
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
