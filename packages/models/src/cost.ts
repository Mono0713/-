import { findModel, type ProviderInfo } from './catalog.ts'
import type { ModelChoice, Route, Task } from './routing.ts'

/** Tokens one unit of work takes. */
export interface UnitTokens {
  input: number
  output: number
}

/**
 * Typical tokens per unit of each task, used until the person's own usage says otherwise:
 * a page read (image, instructions, the JSON reply), an answer read from handwriting,
 * a marking request (up to ten answers sharing the instructions), a tutoring reply,
 * a question translated, a question answered or explained, an exam written from about ten pages of material.
 */
export const TYPICAL: Record<Task, UnitTokens> = {
  recognition: { input: 6000, output: 3000 },
  handwriting: { input: 1200, output: 300 },
  grading: { input: 4000, output: 1200 },
  tutoring: { input: 3000, output: 600 },
  translation: { input: 300, output: 300 },
  solving: { input: 1500, output: 400 },
  explaining: { input: 1500, output: 700 },
  generating: { input: 20000, output: 8000 },
}

/** Share of pages read a second time by the escalation model, on average. */
export const ESCALATED_SHARE = 0.15

/** Cost in US dollars of `units` units on one model; null when its price is unknown. */
export function unitCost(choice: ModelChoice, providers: ProviderInfo[], tokens: UnitTokens, units = 1): number | null {
  const price = findModel(providers.find((p) => p.id === choice.provider), choice.model)?.price
  if (!price) return null
  return (units * (tokens.input * price.input + tokens.output * price.output)) / 1_000_000
}

/**
 * Expected cost of `units` units of a routed task, escalation included.
 * `measured` is the person's own average per unit on the primary model, when known.
 */
export function routeCost(r: Route, providers: ProviderInfo[], units: number, measured?: UnitTokens | null): number | null {
  const tokens = measured ?? TYPICAL[r.task]
  const base = unitCost(r.primary, providers, tokens, units)
  if (base === null) return null
  if (!r.escalate) return base
  const extra = unitCost(r.escalate, providers, TYPICAL[r.task], units * ESCALATED_SHARE)
  return extra === null ? base : base + extra
}

/** Dollars as people read them: two significant digits for small sums. */
export function formatUsd(usd: number): string {
  if (usd === 0) return 'US$0'
  if (usd < 0.01) return `US$${usd.toPrecision(1)}`
  if (usd < 1) return `US$${usd.toFixed(2)}`
  return `US$${usd.toFixed(usd < 10 ? 2 : 0)}`
}
