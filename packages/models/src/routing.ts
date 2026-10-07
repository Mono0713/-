import { TIERS, type ModelInfo, type ProviderInfo, type Tier } from './catalog.ts'

/** The jobs the app gives AI. Each picks its own model, so the cheap jobs never pay for the expensive ones. */
export type Task = 'recognition' | 'handwriting' | 'grading' | 'tutoring' | 'translation' | 'solving' | 'explaining'
export const TASKS: readonly Task[] = ['recognition', 'handwriting', 'grading', 'tutoring', 'translation', 'solving', 'explaining']

/** The one setting most people touch: save money, balance, or be as accurate as possible. */
export type Strength = 'save' | 'balanced' | 'best'
export const STRENGTHS: readonly Strength[] = ['save', 'balanced', 'best']

/** Tasks that always send images, so only models that can see qualify. */
const NEEDS_VISION: Record<Task, boolean> = { recognition: true, handwriting: true, grading: false, tutoring: false, translation: false, solving: false, explaining: false }

/** Whether a task always sends images (pages, handwriting), so its model must see them. */
export const readsImages = (task: Task): boolean => NEEDS_VISION[task]

/**
 * Tasks about one question that send its pictures when it has any. They can run on a text-only
 * model for questions without pictures and on another model, one that sees, for those with them.
 */
export const PICTURE_TASKS: readonly Task[] = ['solving', 'explaining', 'tutoring']

/**
 * Which tier each task uses at each strength, and for recognition, the tier a doubtful
 * page is read again with. Marking answers and translating are easy; reading a scanned
 * page is hard, so only reading moves up to the best tier.
 */
export const PLAN: Record<Task, Record<Strength, { tier: Tier; escalate?: Tier }>> = {
  recognition: { save: { tier: 'fast' }, balanced: { tier: 'balanced', escalate: 'best' }, best: { tier: 'best' } },
  handwriting: { save: { tier: 'fast' }, balanced: { tier: 'balanced' }, best: { tier: 'best' } },
  grading: { save: { tier: 'fast' }, balanced: { tier: 'fast' }, best: { tier: 'balanced' } },
  tutoring: { save: { tier: 'fast' }, balanced: { tier: 'balanced' }, best: { tier: 'best' } },
  translation: { save: { tier: 'fast' }, balanced: { tier: 'fast' }, best: { tier: 'balanced' } },
  // Working out a key the paper left out, and writing a worked explanation: both need real reasoning.
  solving: { save: { tier: 'fast' }, balanced: { tier: 'balanced' }, best: { tier: 'best' } },
  explaining: { save: { tier: 'fast' }, balanced: { tier: 'balanced' }, best: { tier: 'best' } },
}

export interface ModelChoice {
  provider: string
  model: string
}

export interface Route {
  task: Task
  strength: Strength
  primary: ModelChoice
  /** Tried in order when the primary fails or runs out of quota. */
  fallbacks: ModelChoice[]
  /** Reads doubtful pages again; null when the strength does not escalate. */
  escalate: ModelChoice | null
}

export interface RouteOptions {
  /** A model the person picked for this task; it wins while its provider has a key (and, with images, sees them). */
  override?: ModelChoice | null
  /** This request carries images (a question's pictures): only models that see them qualify. */
  pictures?: boolean
}

/**
 * Picks the models for a task from the providers that have a key. Without an override,
 * the cheapest provider at the task's tier goes first and the others follow as fallbacks.
 * A provider without a model of that tier uses its nearest one. Null when no provider can do it.
 */
export function route(task: Task, strength: Strength, providers: ProviderInfo[], opts: RouteOptions = {}): Route | null {
  const plan = PLAN[task][strength]
  const sees = NEEDS_VISION[task] || Boolean(opts.pictures)
  const usable = providers.filter((p) => p.ready && candidates(p, sees).length > 0)
  const picks = usable
    .map((p) => ({ provider: p, model: nearest(candidates(p, sees), plan.tier)! }))
    .sort((a, b) => cost(a.model) - cost(b.model))
  const o = opts.override
  const override = o && usable.some((p) => p.id === o.provider) && (!sees || canSee(providers, o)) ? o : null
  const ordered = picks.map((p) => ({ provider: p.provider.id, model: p.model.id }))
  const primary = override ?? ordered[0]
  if (!primary) return null
  const fallbacks = ordered.filter((c) => c.provider !== primary.provider)
  let escalate: ModelChoice | null = null
  if (plan.escalate && !override) {
    const provider = usable.find((p) => p.id === primary.provider)!
    const up = nearest(candidates(provider, sees), plan.escalate)!
    if (up.id !== primary.model) escalate = { provider: provider.id, model: up.id }
  }
  return { task, strength, primary, fallbacks, escalate }
}

function candidates(p: ProviderInfo, sees: boolean): ModelInfo[] {
  return sees ? p.models.filter((m) => m.vision) : p.models
}

/** Whether a chosen model reads images; one typed in by hand that the list does not know is trusted to. */
export function canSee(providers: ProviderInfo[], choice: ModelChoice): boolean {
  return providers.find((p) => p.id === choice.provider)?.models.find((m) => m.id === choice.model)?.vision ?? true
}

/** The model of the wanted tier, else the closest tier, preferring the more capable one on a tie. */
export function nearest(models: ModelInfo[], tier: Tier): ModelInfo | undefined {
  const want = TIERS.indexOf(tier)
  let best: ModelInfo | undefined
  let bestScore = Infinity
  for (const m of models) {
    const d = TIERS.indexOf(m.tier) - want
    const score = Math.abs(d) * 2 + (d < 0 ? 1 : 0)
    if (score < bestScore) [best, bestScore] = [m, score]
  }
  return best
}

/** A rough per-token cost to rank models; unknown prices rank last. */
function cost(m: ModelInfo): number {
  return m.price ? m.price.input + m.price.output / 4 : Infinity
}
