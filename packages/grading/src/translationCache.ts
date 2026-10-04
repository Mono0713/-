import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { Sql } from '@exam/db'
import type { Translation } from './translate.ts'

export type TranslationEngine = 'free' | 'ai'

/** Remembers translated questions, so the same question is translated once for everyone who reads it in that language. */
export interface TranslationCache {
  get(key: string): Promise<Translation | null>
  set(key: string, translation: Translation): Promise<void>
}

/** Identifies a question's text, the reader's language and the way it was translated; any edit to the text makes a new key. */
export function translationKey(q: { stem: string; options: { content: string }[] }, language: string, engine: TranslationEngine): string {
  return createHash('sha256').update(JSON.stringify([q.stem, q.options.map((o) => o.content), language, engine])).digest('hex')
}

export class SqliteTranslationCache implements TranslationCache {
  private readonly db: DatabaseSync

  /** `path` can be the bank's database file, or ":memory:". */
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec(`CREATE TABLE IF NOT EXISTS translation_cache (key TEXT PRIMARY KEY, translation TEXT NOT NULL, created_at TEXT NOT NULL)`)
  }

  async get(key: string): Promise<Translation | null> {
    const row = this.db.prepare('SELECT translation FROM translation_cache WHERE key = ?').get(key) as { translation: string } | undefined
    return row ? (JSON.parse(row.translation) as Translation) : null
  }

  async set(key: string, translation: Translation): Promise<void> {
    this.db.prepare('INSERT OR REPLACE INTO translation_cache (key, translation, created_at) VALUES (?, ?, ?)').run(key, JSON.stringify(translation), new Date().toISOString())
  }
}

/** The same cache in Postgres (Supabase), shared across users: a key only says which text and language. */
export class PostgresTranslationCache implements TranslationCache {
  constructor(private readonly sql: Sql) {}

  async get(key: string): Promise<Translation | null> {
    const [row] = await this.sql`select translation from translation_cache where key = ${key}`
    return (row?.translation as Translation | undefined) ?? null
  }

  async set(key: string, translation: Translation): Promise<void> {
    await this.sql`insert into translation_cache (key, translation) values (${key}, ${this.sql.json(translation as never)})
      on conflict (key) do update set translation = excluded.translation, created_at = now()`
  }
}
