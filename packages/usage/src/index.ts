import { DatabaseSync } from 'node:sqlite'
import type { Sql } from '@exam/db'
import type { Task } from '@exam/models'
import type { UsageEntry, UsageRow } from './estimates.ts'

export * from './estimates.ts'


/** A log of AI calls per person: what the settings page shows as spend, and what estimates learn from. */
export interface UsageStore {
  record(entry: UsageEntry): Promise<void>
  /** Totals per task and model since a moment; only calls with this scope when given. */
  summary(ownerId: string, since: Date, scope?: string): Promise<UsageRow[]>
}

export class SqliteUsageStore implements UsageStore {
  private readonly db: DatabaseSync

  /** `path` can be the bank's database file, or ":memory:". */
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec(`CREATE TABLE IF NOT EXISTS ai_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id TEXT NOT NULL, task TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
      input_tokens INTEGER, output_tokens INTEGER, units INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`)
    this.db.exec('CREATE INDEX IF NOT EXISTS ai_usage_owner_created ON ai_usage (owner_id, created_at)')
    // added after the table
    if (!(this.db.prepare('PRAGMA table_info(ai_usage)').all() as { name: string }[]).some((c) => c.name === 'scope')) {
      this.db.exec('ALTER TABLE ai_usage ADD COLUMN scope TEXT')
    }
  }

  async record(e: UsageEntry): Promise<void> {
    this.db
      .prepare('INSERT INTO ai_usage (owner_id, task, provider, model, input_tokens, output_tokens, units, scope, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(e.ownerId, e.task, e.provider, e.model, e.inputTokens, e.outputTokens, e.units ?? 1, e.scope ?? null, new Date().toISOString())
  }

  async summary(ownerId: string, since: Date, scope?: string): Promise<UsageRow[]> {
    const rows = this.db
      .prepare(
        `SELECT task, provider, model, COUNT(*) AS calls, SUM(units) AS units, COALESCE(SUM(input_tokens), 0) AS input_tokens, COALESCE(SUM(output_tokens), 0) AS output_tokens
         FROM ai_usage WHERE owner_id = ? AND created_at >= ? AND (? IS NULL OR scope = ?) GROUP BY task, provider, model ORDER BY task, provider, model`,
      )
      .all(ownerId, since.toISOString(), scope ?? null, scope ?? null)
    return rows.map(toRow)
  }
}

export class PostgresUsageStore implements UsageStore {
  constructor(private readonly sql: Sql) {}

  async record(e: UsageEntry): Promise<void> {
    await this.sql`insert into ai_usage (owner_id, task, provider, model, input_tokens, output_tokens, units, scope)
      values (${e.ownerId}, ${e.task}, ${e.provider}, ${e.model}, ${e.inputTokens}, ${e.outputTokens}, ${e.units ?? 1}, ${e.scope ?? null})`
  }

  async summary(ownerId: string, since: Date, scope?: string): Promise<UsageRow[]> {
    const rows = await this.sql`select task, provider, model, count(*)::int as calls, sum(units)::int as units,
        coalesce(sum(input_tokens), 0)::bigint as input_tokens, coalesce(sum(output_tokens), 0)::bigint as output_tokens
      from ai_usage where owner_id = ${ownerId} and created_at >= ${since} ${scope === undefined ? this.sql`` : this.sql`and scope = ${scope}`}
      group by task, provider, model order by task, provider, model`
    return rows.map(toRow)
  }
}

function toRow(r: Record<string, unknown>): UsageRow {
  return {
    task: String(r.task) as Task,
    provider: String(r.provider),
    model: String(r.model),
    calls: Number(r.calls),
    units: Number(r.units),
    inputTokens: Number(r.input_tokens),
    outputTokens: Number(r.output_tokens),
  }
}
