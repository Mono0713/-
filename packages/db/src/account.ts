import type { Sql } from 'postgres'

/**
 * A whole account's rows, for "download my data" and "delete my account". This file knows every
 * table that holds a person's data: a new migration with an owner column adds its table here too
 * (test/account.test.ts fails on any table it does not know).
 */

/** Tables with an `owner_id` column, children before parents so deletes never trip a reference. */
const OWNED = ['ai_usage', 'share_copies', 'exam_shares', 'quiz_attempts', 'classes', 'questions', 'exams', 'imports', 'user_settings'] as const

/** Tables tied to a person through another column, or holding no one's data (caches keyed by content). */
export const ACCOUNT_TABLES = {
  owned: OWNED,
  byUser: ['class_members', 'class_attempts'],
  byOwner: ['file_refs'],
  shared: ['grading_cache', 'translation_cache', 'class_assignments', 'schema_migrations'],
} as const

/** Everything stored for the person, as plain JSON; saved API keys are left out. */
export async function exportAccount(sql: Sql, ownerId: string): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {}
  for (const table of OWNED) {
    // api_keys is encrypted and only the server can read it: never part of a download.
    const rows = table === 'user_settings' ? await sql`select owner_id, settings from user_settings where owner_id = ${ownerId}` : await sql`select * from ${sql(table)} where owner_id = ${ownerId}`
    out[table] = [...rows]
  }
  out.class_members = [...(await sql`select * from class_members where user_id = ${ownerId}`)]
  out.class_attempts = [...(await sql`select * from class_attempts where user_id = ${ownerId}`)]
  out.files = [...(await sql`select key, size::float8 as size from file_refs where owner = ${ownerId} order by key`)]
  return out
}

/** The person's file keys, to remove from file storage before their rows go. */
export async function accountFileKeys(sql: Sql, ownerId: string): Promise<string[]> {
  const rows = await sql`select key from file_refs where owner = ${ownerId}`
  return rows.map((r) => String(r.key))
}

/**
 * Deletes every row of the person in one transaction. Classes they teach go with their members
 * and assignments; in other people's classes, only their own membership and hand-ins go.
 */
export async function eraseAccount(sql: Sql, ownerId: string): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`delete from class_attempts where user_id = ${ownerId}`
    await tx`delete from class_members where user_id = ${ownerId}`
    for (const table of OWNED) await tx`delete from ${tx(table)} where owner_id = ${ownerId}`
    await tx`delete from file_refs where owner = ${ownerId}`
  })
}
