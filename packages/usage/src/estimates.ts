import { unitCost, type ProviderInfo, type Task, type UnitTokens } from '@exam/models'

// Plain functions over usage totals, safe to use in the browser (no database here).

/** One AI call. `units` is what the call did: pages read, answers marked, … */
export interface UsageEntry {
  ownerId: string
  task: Task
  provider: string
  model: string
  inputTokens: number | null
  outputTokens: number | null
  units?: number
  /** What the call was for when someone else's work was paid for, e.g. "class:<id>" for a class's marking. */
  scope?: string
}

/** Calls of one task on one model, added up. */
export interface UsageRow {
  task: Task
  provider: string
  model: string
  calls: number
  units: number
  inputTokens: number
  outputTokens: number
}

/** Spend of the rows in US dollars, and whether some of it is missing because a model's price is unknown. */
export function spend(rows: UsageRow[], providers: ProviderInfo[]): { usd: number; unpriced: boolean } {
  let usd = 0
  let unpriced = false
  for (const r of rows) {
    const cost = unitCost({ provider: r.provider, model: r.model }, providers, { input: r.inputTokens, output: r.outputTokens })
    if (cost === null) unpriced = true
    else usd += cost
  }
  return { usd, unpriced }
}

/** The average tokens per unit of a task on one model, once there is enough to go on. */
export function measuredPerUnit(rows: UsageRow[], task: Task, model: string, minUnits = 3): UnitTokens | null {
  const mine = rows.filter((r) => r.task === task && r.model === model && r.inputTokens > 0)
  const units = mine.reduce((n, r) => n + r.units, 0)
  if (units < minUnits) return null
  return { input: mine.reduce((n, r) => n + r.inputTokens, 0) / units, output: mine.reduce((n, r) => n + r.outputTokens, 0) / units }
}

/** The first moment of the current calendar month, in UTC. */
export function monthStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}
