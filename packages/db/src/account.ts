import { DatabaseSync } from 'node:sqlite'
import type { Sql } from 'postgres'

/**
 * A whole account's rows, for "download my data" and "delete my account", in Postgres or in the
 * local SQLite file (both use the same table and column names). This file knows every table that
 * holds a person's data: a new table with an owner column is added here too (test/account.test.ts
 * fails on any Postgres table it does not know). Settings live in the settings store, not here.
 */

/** Tables with an `owner_id` column, children before parents so deletes never trip a reference. */
const OWNED = ['ai_usage', 'share_copies', 'exam_shares', 'quiz_attempts', 'classes', 'questions', 'exams', 'imports'] as const
/** Tables tied to a person through `user_id`: memberships and hand-ins in other people's classes. */
const BY_USER = ['class_attempts', 'class_members'] as const

export const ACCOUNT_TABLES = {
  owned: OWNED,
  byUser: BY_USER,
  byOwner: ['file_refs'],
  /** Handled by the settings store (it also holds the encrypted API keys). */
  settings: ['user_settings'],
  /** Nobody's data: caches keyed by content, assignments (go with their class), bookkeeping. */
  shared: ['grading_cache', 'translation_cache', 'class_assignments', 'schema_migrations'],
} as const

/** The few queries both databases answer the same way. Placeholders are written `?`. */
export interface AccountDb {
  tables(): Promise<Set<string>>
  all(query: string, params: unknown[]): Promise<Record<string, unknown>[]>
  /** Runs the statements in one transaction. */
  transaction(statements: [string, unknown[]][]): Promise<void>
}

const numbered = (query: string) => {
  let i = 0
  return query.replace(/\?/g, () => `$${++i}`)
}

export function postgresAccountDb(sql: Sql): AccountDb {
  return {
    tables: async () => new Set((await sql`select table_name from information_schema.tables where table_schema = current_schema()`).map((r) => String(r.table_name))),
    all: async (query, params) => [...(await sql.unsafe(numbered(query), params as never[]))],
    transaction: async (statements) => {
      await sql.begin(async (tx) => {
        for (const [query, params] of statements) await tx.unsafe(numbered(query), params as never[])
      })
    },
  }
}

export function sqliteAccountDb(file: string): AccountDb {
  let db: DatabaseSync | null = null
  const open = () => (db ??= new DatabaseSync(file))
  return {
    tables: async () => new Set(open().prepare(`select name from sqlite_master where type = 'table'`).all().map((r) => String(r.name))),
    all: async (query, params) => open().prepare(query).all(...(params as never[])) as Record<string, unknown>[],
    transaction: async (statements) => {
      const conn = open()
      conn.exec('BEGIN')
      try {
        for (const [query, params] of statements) conn.prepare(query).run(...(params as never[]))
        conn.exec('COMMIT')
      } catch (err) {
        conn.exec('ROLLBACK')
        throw err
      }
    },
  }
}

/** Everything stored for the person in the database, as plain rows (settings come from the settings store). */
export async function exportAccount(db: AccountDb, ownerId: string): Promise<Record<string, unknown[]>> {
  const present = await db.tables()
  const out: Record<string, unknown[]> = {}
  for (const table of OWNED) if (present.has(table)) out[table] = await db.all(`select * from ${table} where owner_id = ?`, [ownerId])
  for (const table of BY_USER) if (present.has(table)) out[table] = await db.all(`select * from ${table} where user_id = ?`, [ownerId])
  if (present.has('file_refs')) out.files = (await db.all(`select key, size from file_refs where owner = ? order by key`, [ownerId])).map((r) => ({ key: r.key, size: Number(r.size) }))
  return out
}

/** The person's file keys, to remove from file storage before their rows go. */
export async function accountFileKeys(db: AccountDb, ownerId: string): Promise<string[]> {
  if (!(await db.tables()).has('file_refs')) return []
  return (await db.all(`select key from file_refs where owner = ?`, [ownerId])).map((r) => String(r.key))
}

/**
 * Deletes every row of the person in one transaction. Classes they teach go with their members
 * and assignments; in other people's classes, only their own membership and hand-ins go.
 */
export async function eraseAccount(db: AccountDb, ownerId: string): Promise<void> {
  const present = await db.tables()
  const statements: [string, unknown[]][] = []
  for (const table of BY_USER) if (present.has(table)) statements.push([`delete from ${table} where user_id = ?`, [ownerId]])
  // What hangs off their classes and share links: Postgres cascades it, SQLite does not enforce references.
  const mine = `select id from classes where owner_id = ?`
  if (present.has('class_attempts')) statements.push([`delete from class_attempts where assignment_id in (select id from class_assignments where class_id in (${mine}))`, [ownerId]])
  if (present.has('class_members')) statements.push([`delete from class_members where class_id in (${mine})`, [ownerId]])
  if (present.has('class_assignments')) statements.push([`delete from class_assignments where class_id in (${mine})`, [ownerId]])
  if (present.has('share_copies')) statements.push([`delete from share_copies where token in (select token from exam_shares where owner_id = ?)`, [ownerId]])
  for (const table of OWNED) if (present.has(table)) statements.push([`delete from ${table} where owner_id = ?`, [ownerId]])
  if (present.has('file_refs')) statements.push([`delete from file_refs where owner = ?`, [ownerId]])
  await db.transaction(statements)
}
