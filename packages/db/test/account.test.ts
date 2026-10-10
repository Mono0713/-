import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ACCOUNT_TABLES, accountFileKeys, eraseAccount, exportAccount, postgresAccountDb, sqliteAccountDb, testDatabase, type AccountDb, type Sql } from '../src/index.ts'

const pg = await testDatabase()

/** Alice teaches a class Bob joined and handed work in to; each owns an import, exam and file. */
async function seed(db: AccountDb) {
  const statements: [string, unknown[]][] = []
  for (const owner of ['alice', 'bob']) {
    const imp = randomUUID()
    statements.push([`insert into imports (id, owner_id, file_name, page_count, provider, status) values (?, ?, 'a.pdf', 1, 'claude', 'done')`, [imp, owner]])
    statements.push([`insert into exams (id, owner_id, import_id, title) values (?, ?, ?, 'x')`, [randomUUID(), owner, imp]])
    statements.push([`insert into file_refs (key, blob, size, owner) values (?, 'blobs/a', 1, ?)`, [`u/${owner}/a.webp`, owner]])
  }
  const cls = randomUUID()
  const assignment = randomUUID()
  const attempt = randomUUID()
  statements.push([`insert into classes (id, owner_id, name, join_code) values (?, 'alice', 'c', 'abc')`, [cls]])
  statements.push([`insert into class_members (class_id, user_id, role, name) values (?, 'bob', 'student', 'Bob')`, [cls]])
  statements.push([`insert into class_assignments (id, class_id, title, settings, sources) values (?, ?, 'hw', '{}', '[]')`, [assignment, cls]])
  statements.push([`insert into quiz_attempts (id, owner_id, data, started_at) values (?, 'bob', '{}', ?)`, [attempt, new Date().toISOString()]])
  statements.push([`insert into class_attempts (attempt_id, assignment_id, user_id) values (?, ?, 'bob')`, [attempt, assignment]])
  await db.transaction(statements)
}

function behaves(make: () => AccountDb) {
  let db: AccountDb
  beforeAll(async () => {
    db = make()
    await seed(db)
  })

  it('exports the person and their files', async () => {
    const data = await exportAccount(db, 'alice')
    expect(data.imports).toHaveLength(1)
    expect(data.classes).toHaveLength(1)
    expect(data.files).toEqual([{ key: 'u/alice/a.webp', size: 1 }])
    expect(await accountFileKeys(db, 'alice')).toEqual(['u/alice/a.webp'])
  })

  it('erases only that person, with the classes they teach', async () => {
    await eraseAccount(db, 'alice')
    const left = await exportAccount(db, 'alice')
    expect(Object.values(left).every((rows) => rows.length === 0)).toBe(true)
    expect(await db.all(`select * from class_members`, [])).toEqual([])
    expect(await db.all(`select * from class_attempts`, [])).toEqual([])
    const bob = await exportAccount(db, 'bob')
    expect(bob.exams).toHaveLength(1)
    expect(bob.quiz_attempts).toHaveLength(1)
    expect(bob.files).toHaveLength(1)
  })
}

describe('account export and erase (SQLite)', () => {
  behaves(() => {
    const file = join(mkdtempSync(join(tmpdir(), 'account-')), 'bank.sqlite')
    // the columns the stores create that these tests touch
    new DatabaseSync(file).exec(`
      CREATE TABLE imports (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, file_name TEXT, page_count INTEGER, provider TEXT, status TEXT);
      CREATE TABLE exams (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, import_id TEXT, title TEXT);
      CREATE TABLE quiz_attempts (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, data TEXT NOT NULL, started_at TEXT NOT NULL);
      CREATE TABLE file_refs (key TEXT PRIMARY KEY, blob TEXT NOT NULL, size INTEGER NOT NULL, owner TEXT);
      CREATE TABLE classes (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, join_code TEXT NOT NULL);
      CREATE TABLE class_members (class_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, name TEXT NOT NULL);
      CREATE TABLE class_assignments (id TEXT PRIMARY KEY, class_id TEXT NOT NULL, title TEXT NOT NULL, settings TEXT NOT NULL, sources TEXT NOT NULL);
      CREATE TABLE class_attempts (attempt_id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL, user_id TEXT NOT NULL);`)
    return sqliteAccountDb(file)
  })
})

describe.skipIf(!pg)('account export and erase (Postgres)', () => {
  const sql = pg?.sql as Sql
  afterAll(() => pg?.drop())

  behaves(() => postgresAccountDb(sql))

  it('knows every table in the schema', async () => {
    const rows = await sql`select table_name from information_schema.tables where table_schema = current_schema()`
    const known = new Set<string>(Object.values(ACCOUNT_TABLES).flat())
    expect(rows.map((r) => String(r.table_name)).filter((t) => !known.has(t))).toEqual([])
  })
})
