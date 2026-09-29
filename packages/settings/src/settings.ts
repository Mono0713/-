import { z } from 'zod'

/** One user's preferences. Every field has a default, so an old or partial file still loads. */
export const Settings = z.object({
  /** Interface language; the model also writes its review notes in it. null: not chosen yet. */
  locale: z.string().nullable().default(null),
  /** Recognition method preselected when uploading ("manual", "claude", …). */
  defaultProvider: z.string().default('manual'),
  /** Model preselected for each provider, e.g. { claude: "claude-sonnet-5-5" }. */
  models: z.record(z.string(), z.string()).default({}),
  /** API keys per provider. Secret: never sent to the browser, see `publicView`. */
  apiKeys: z.record(z.string(), z.string()).default({}),
  /** The AI teacher that marks answers the program cannot check itself. null provider or model: pick automatically. */
  aiGrading: z
    .object({ enabled: z.boolean().default(true), provider: z.string().nullable().default(null), model: z.string().nullable().default(null) })
    .default({ enabled: true, provider: null, model: null }),
  /** Model ids the provider's API reported last time they were fetched. */
  knownModels: z.record(z.string(), z.array(z.string())).default({}),
})
export type Settings = z.infer<typeof Settings>

export const defaultSettings = (): Settings => Settings.parse({})

/** What the browser may see of an API key: whether one is saved and its last four characters. */
export interface KeyStatus {
  saved: boolean
  hint: string | null
}

export type PublicSettings = Omit<Settings, 'apiKeys'> & { apiKeys: Record<string, KeyStatus> }

export function publicView(s: Settings): PublicSettings {
  const apiKeys = Object.fromEntries(Object.entries(s.apiKeys).map(([id, key]) => [id, { saved: true, hint: key.length > 8 ? key.slice(-4) : null }]))
  return { ...s, apiKeys }
}
