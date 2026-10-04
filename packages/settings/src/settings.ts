import type { Strength as StrengthId, Task as TaskId, Tier } from '@exam/models'
import { z } from 'zod'

const Strength = z.enum(['save', 'balanced', 'best'] as const satisfies readonly StrengthId[])
const Task = z.enum(['recognition', 'handwriting', 'grading', 'tutoring', 'translation'] as const satisfies readonly TaskId[])
const TierEnum = z.enum(['fast', 'balanced', 'best'] as const satisfies readonly Tier[])

/** A service the person added: anything that speaks the OpenAI Chat Completions format. Its key is in apiKeys under `id`. */
export const CustomProvider = z.object({
  id: z.string().regex(/^c-[a-z0-9-]{1,40}$/),
  name: z.string().min(1).max(60),
  baseUrl: z.string().url(),
  models: z
    .array(
      z.object({
        id: z.string().min(1),
        tier: TierEnum.default('balanced'),
        vision: z.boolean().default(true),
        /** US dollars per million tokens, when the person knows it; only for estimates. */
        price: z.object({ input: z.number().min(0), output: z.number().min(0) }).nullable().default(null),
      }),
    )
    .default([]),
})
export type CustomProvider = z.infer<typeof CustomProvider>

/** One user's preferences. Every field has a default, so an old or partial file still loads. */
export const Settings = z.object({
  /** Interface language; the model also writes its review notes in it. null: not chosen yet. */
  locale: z.string().nullable().default(null),
  /** Recognition method preselected when uploading ("auto", "manual", "claude", …). */
  defaultProvider: z.string().default('auto'),
  /** Model preselected for each provider, e.g. { claude: "claude-sonnet-5-5" }. */
  models: z.record(z.string(), z.string()).default({}),
  /** API keys per provider. Secret: never sent to the browser, see `publicView`. */
  apiKeys: z.record(z.string(), z.string()).default({}),
  /** The AI teacher that marks answers the program cannot check itself. null provider or model: pick automatically. */
  aiGrading: z
    .object({ enabled: z.boolean().default(true), provider: z.string().nullable().default(null), model: z.string().nullable().default(null) })
    .default({ enabled: true, provider: null, model: null }),
  /** How questions get translated: free services with no key, or the AI on the translation route. */
  translationEngine: z.enum(['free', 'ai']).default('free'),
  /** How hard the AI tries, for every task: save money, balanced, or most accurate. */
  strength: Strength.default('balanced'),
  /** Per-task strength that differs from `strength` (advanced settings). */
  taskStrength: z.partialRecord(Task, Strength).default({}),
  /** Per-task model picked by hand; it wins over the strength while its provider has a key. */
  taskModels: z.partialRecord(Task, z.object({ provider: z.string(), model: z.string() })).default({}),
  /** Services added by the person, beside Claude, OpenAI and Gemini. */
  customProviders: z.array(CustomProvider).default([]),
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
