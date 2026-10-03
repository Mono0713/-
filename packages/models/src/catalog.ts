/** fast: cheapest; balanced; best: most accurate on handwriting and dense layouts. */
export type Tier = 'fast' | 'balanced' | 'best'
export const TIERS: readonly Tier[] = ['fast', 'balanced', 'best']

/** US dollars per million tokens. */
export interface Price {
  input: number
  output: number
}

export interface ModelInfo {
  id: string
  label: string
  tier: Tier
  /** Can read images: needed to read exam pages and handwriting. */
  vision: boolean
  /** Unknown for models people add themselves without a price. */
  price: Price | null
}

/** A service the app can call: one of the built-in three, or one the person added. */
export interface ProviderInfo {
  id: string
  label: string
  /** An API key is available. */
  ready: boolean
  models: ModelInfo[]
}

/**
 * Well-known models of the built-in providers, with their tier and list price.
 * Prices are approximate list prices in USD (2026-10); they only feed estimates.
 * Providers retire models over time: a model missing here can still be typed in by id.
 */
export const BUILTIN_MODELS: Record<string, ModelInfo[]> = {
  claude: [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', tier: 'best', vision: true, price: { input: 4, output: 20 } },
    { id: 'claude-opus-5', label: 'Claude Opus 5', tier: 'best', vision: true, price: { input: 5, output: 25 } },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', tier: 'balanced', vision: true, price: { input: 2, output: 10 } },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', tier: 'fast', vision: true, price: { input: 1, output: 5 } },
  ],
  openai: [
    { id: 'gpt-5', label: 'GPT-5', tier: 'best', vision: true, price: { input: 1.25, output: 10 } },
    { id: 'gpt-5-mini', label: 'GPT-5 mini', tier: 'balanced', vision: true, price: { input: 0.25, output: 2 } },
    { id: 'gpt-5-nano', label: 'GPT-5 nano', tier: 'fast', vision: true, price: { input: 0.05, output: 0.4 } },
  ],
  gemini: [
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)', tier: 'best', vision: true, price: { input: 2, output: 12 } },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', tier: 'balanced', vision: true, price: { input: 1.25, output: 10 } },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tier: 'fast', vision: true, price: { input: 0.3, output: 2.5 } },
  ],
}

export const BUILTIN_LABELS: Record<string, string> = { claude: 'Claude', openai: 'OpenAI', gemini: 'Gemini' }

/** The model of a provider, by id, among its listed models. */
export function findModel(provider: ProviderInfo | undefined, modelId: string): ModelInfo | undefined {
  return provider?.models.find((m) => m.id === modelId)
}
