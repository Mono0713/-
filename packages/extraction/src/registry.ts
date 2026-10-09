import { keySetId, withKeys } from '@exam/core'
import type { VisionProvider } from './provider.ts'
import { ClaudeProvider } from './providers/claude.ts'
import { GeminiProvider } from './providers/gemini.ts'
import { ManualProvider, type TextFiles } from './providers/manual.ts'
import { OpenAICompatibleProvider } from './providers/compatible.ts'
import { OpenAIProvider } from './providers/openai.ts'

export interface ProviderConfig {
  apiKey?: string
  /** Several keys for the same service: tried in turn when one is out of quota or refused (see `withKeys`). */
  apiKeys?: string[]
  model?: string
  /** An OpenAI-compatible service at this address instead of the provider's own API. */
  baseUrl?: string
  /** Folder for providers that exchange files instead of calling an API (manual). */
  workDir?: string
  /** Or somewhere else to keep those files (the web app's file store). */
  files?: TextFiles
}

type Factory = (config: ProviderConfig) => VisionProvider

const factories = new Map<string, Factory>([
  ['claude', (c) => new ClaudeProvider(c)],
  ['openai', (c) => new OpenAIProvider(c)],
  ['gemini', (c) => new GeminiProvider(c)],
  [
    'manual',
    (c) => {
      if (!c.workDir && !c.files) throw new Error('The manual provider needs a workDir')
      return new ManualProvider({ workDir: c.workDir, files: c.files, model: c.model })
    },
  ],
])

/** Adds or replaces a provider, e.g. a self-hosted model. */
export function registerProvider(id: string, factory: Factory): void {
  factories.set(id, factory)
}

export function providerIds(): string[] {
  return [...factories.keys()]
}

/**
 * Creates a provider. When no model is given, `<ID>_MODEL` from the environment
 * (e.g. GEMINI_MODEL) wins over the adapter's built-in default, so a retired
 * model can be swapped without a code change.
 */
export function createProvider(id: string, config: ProviderConfig = {}): VisionProvider {
  const keys = config.apiKeys ?? []
  if (keys.length > 1) {
    const each = keys.map((apiKey) => createProvider(id, { ...config, apiKey, apiKeys: undefined }))
    const setId = keySetId(id, keys)
    return {
      id: each[0]!.id,
      model: each[0]!.model,
      complete: (request) => withKeys(setId, each, (p) => p.complete(request)),
      invalidReply: () => each.forEach((p) => p.invalidReply?.()),
    }
  }
  if (keys.length === 1) config = { ...config, apiKey: keys[0] }
  if (config.baseUrl && id !== 'manual') return new OpenAICompatibleProvider({ id, baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model })
  const factory = factories.get(id)
  if (!factory) throw new Error(`Unknown provider "${id}". Available: ${providerIds().join(', ')}`)
  const model = config.model ?? (process.env[`${id.toUpperCase()}_MODEL`] || undefined)
  return factory({ ...config, model })
}
