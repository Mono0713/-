import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { Sql } from '@exam/db'
import type { GradingTask, Marking } from '@exam/quiz'

/** Remembers how an answer to a question was marked, so the same answer is never paid for twice. */
export interface GradingCache {
  get(key: string): Promise<Marking | null>
  set(key: string, marking: Marking): Promise<void>
}

/**
 * Identifies a question and an answer. It changes when the question, its key or its explanation
 * is edited, or when the answer differs by more than case and spacing.
 */
export function cacheKey({ item, response }: GradingTask, language: string): string {
  const q = item.question
  const question = [q.type, q.stem, q.options.map((o) => `${o.label}:${o.content}`), q.answer.values, q.explanation, q.points, item.group?.stem ?? null]
  const answer = response.values.map((v) => v.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim())
  return createHash('sha256').update(JSON.stringify([question, answer, language])).digest('hex')
}

export class SqliteGradingCache implements GradingCache {
  private readonly db: DatabaseSync

  /** `path` can be the bank's database file, or ":memory:". */
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec(`CREATE TABLE IF NOT EXISTS grading_cache (key TEXT PRIMARY KEY, marking TEXT NOT NULL, created_at TEXT NOT NULL)`)
  }

  async get(key: string): Promise<Marking | null> {
    const row = this.db.prepare('SELECT marking FROM grading_cache WHERE key = ?').get(key) as { marking: string } | undefined
    return row ? (JSON.parse(row.marking) as Marking) : null
  }

  async set(key: string, marking: Marking): Promise<void> {
    this.db.prepare('INSERT OR REPLACE INTO grading_cache (key, marking, created_at) VALUES (?, ?, ?)').run(key, JSON.stringify(marking), new Date().toISOString())
  }
}

/** The same cache in Postgres (Supabase). Answers are shared across users: a key only says which question and answer. */
export class PostgresGradingCache implements GradingCache {
  constructor(private readonly sql: Sql) {}

  async get(key: string): Promise<Marking | null> {
    const [row] = await this.sql`select marking from grading_cache where key = ${key}`
    return (row?.marking as Marking | undefined) ?? null
  }

  async set(key: string, marking: Marking): Promise<void> {
    await this.sql`insert into grading_cache (key, marking) values (${key}, ${this.sql.json(marking as never)})
      on conflict (key) do update set marking = excluded.marking, created_at = now()`
  }
}
