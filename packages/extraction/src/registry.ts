import type { VisionProvider } from './provider.ts'
import { ClaudeProvider } from './providers/claude.ts'
import { GeminiProvider } from './providers/gemini.ts'
import { OpenAIProvider } from './providers/openai.ts'

export interface ProviderConfig {
  apiKey?: string
  model?: string
}

type Factory = (config: ProviderConfig) => VisionProvider

const factories = new Map<string, Factory>([
  ['claude', (c) => new ClaudeProvider(c)],
  ['openai', (c) => new OpenAIProvider(c)],
  ['gemini', (c) => new GeminiProvider(c)],
])

/** Adds or replaces a provider, e.g. a self-hosted model. */
export function registerProvider(id: string, factory: Factory): void {
  factories.set(id, factory)
}

export function providerIds(): string[] {
  return [...factories.keys()]
}

export function createProvider(id: string, config: ProviderConfig = {}): VisionProvider {
  const factory = factories.get(id)
  if (!factory) throw new Error(`Unknown provider "${id}". Available: ${providerIds().join(', ')}`)
  return factory(config)
}
