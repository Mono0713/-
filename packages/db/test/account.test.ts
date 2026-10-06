import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ACCOUNT_TABLES, accountFileKeys, eraseAccount, exportAccount, testDatabase, type Sql } from '../src/index.ts'

const pg = await testDatabase()

describe.skipIf(!pg)('account export and erase (Postgres)', () => {
  const sql = pg?.sql as Sql
  afterAll(() => pg?.drop())

  const seed = async (owner: string) => {
    const imp = randomUUID()
    const exam = randomUUID()
    const cls = randomUUID()
    await sql`insert into imports (id, owner_id, file_name, page_count, provider, status) values (${imp}, ${owner}, 'a.pdf', 1, 'claude', 'done')`
    await sql`insert into exams (id, owner_id, import_id, title) values (${exam}, ${owner}, ${imp}, 'x')`
    await sql`insert into user_settings (owner_id, settings, api_keys) values (${owner}, '{"locale":"en"}', 'secret')`
    await sql`insert into classes (id, owner_id, name, join_code) values (${cls}, ${owner}, 'c', ${owner})`
    await sql`insert into file_refs (key, blob, size, owner) values (${`u/${owner}/a.webp`}, 'blobs/a', 1, ${owner})`
  }

  beforeAll(async () => {
    await seed('alice')
    await seed('bob')
  })

  it('knows every table in the schema', async () => {
    const rows = await sql`select table_name from information_schema.tables where table_schema = current_schema()`
    const known = new Set<string>(Object.values(ACCOUNT_TABLES).flat())
    expect(rows.map((r) => String(r.table_name)).filter((t) => !known.has(t))).toEqual([])
  })

  it('exports the person without their API keys', async () => {
    const data = await exportAccount(sql, 'alice')
    expect(data.user_settings).toEqual([{ owner_id: 'alice', settings: { locale: 'en' } }])
    expect(JSON.stringify(data)).not.toContain('secret')
    expect(data.files).toEqual([{ key: 'u/alice/a.webp', size: 1 }])
    expect(await accountFileKeys(sql, 'alice')).toEqual(['u/alice/a.webp'])
  })

  it('erases only that person', async () => {
    await eraseAccount(sql, 'alice')
    const left = await exportAccount(sql, 'alice')
    expect(Object.values(left).every((rows) => rows.length === 0)).toBe(true)
    const bob = await exportAccount(sql, 'bob')
    expect(bob.user_settings).toHaveLength(1)
    expect(bob.files).toHaveLength(1)
  })
})
