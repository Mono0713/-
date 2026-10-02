import { randomBytes } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres, { type Sql } from 'postgres'

export type { Sql, TransactionSql } from 'postgres'

/** SQL files applied in name order; the same folder the Supabase CLI uses. */
export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../supabase/migrations')

/**
 * Opens a connection pool. Prepared statements are off so the Supabase connection
 * pooler (transaction mode) works as well as a direct connection.
 */
export function connect(url: string, opts: { schema?: string; max?: number } = {}): Sql {
  return postgres(url, {
    max: opts.max ?? 10,
    prepare: false,
    onnotice: () => {},
    ...(opts.schema ? { connection: { search_path: opts.schema } } : {}),
  })
}

/** Applies the migrations not applied yet, each in its own transaction. Returns their names. */
export async function migrate(sql: Sql, dir: string = MIGRATIONS_DIR): Promise<string[]> {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`
  const done = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name))
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  const applied: string[] = []
  for (const name of files) {
    if (done.has(name)) continue
    const text = await readFile(join(dir, name), 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(text)
      await tx`insert into schema_migrations (name) values (${name})`
    })
    applied.push(name)
  }
  return applied
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Ids are uuids in Postgres; anything else cannot match a row (and would make the query fail). */
export const isUuid = (id: string): boolean => UUID.test(id)

/** Escapes % and _ so a search term matches literally inside ILIKE. */
export const likePattern = (term: string): string => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/** ISO text for a timestamp column, matching what the SQLite stores return. */
export const iso = (value: Date | string | null): string | null => (value === null ? null : new Date(value).toISOString())

/**
 * A fresh, migrated schema in the database at TEST_DATABASE_URL, for tests of the
 * Postgres stores. Returns null when that variable is not set, so those tests skip.
 */
export async function testDatabase(): Promise<{ sql: Sql; drop: () => Promise<void> } | null> {
  const url = process.env.TEST_DATABASE_URL
  if (!url) return null
  const schema = `test_${randomBytes(6).toString('hex')}`
  const admin = connect(url, { max: 1 })
  await admin.unsafe(`create schema ${schema}`)
  const sql = connect(url, { schema, max: 4 })
  await migrate(sql)
  return {
    sql,
    drop: async () => {
      await sql.end()
      await admin.unsafe(`drop schema ${schema} cascade`)
      await admin.end()
    },
  }
}
