import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { testDatabase } from '@exam/db'
import { DedupFileStore, LocalFileStore, ownerOfKey, PostgresFileIndex, SqliteFileIndex, type FileIndex } from '../src/index.ts'

const pg = await testDatabase()
const dirs: string[] = []
afterAll(async () => {
  await pg?.drop()
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })))
})

const indexes: [string, () => FileIndex][] = [['SqliteFileIndex', () => new SqliteFileIndex(':memory:')]]
if (pg) indexes.push(['PostgresFileIndex', () => new PostgresFileIndex(pg.sql)])

async function stores(index: FileIndex) {
  const dir = await mkdtemp(join(tmpdir(), 'dedup-'))
  dirs.push(dir)
  const inner = new LocalFileStore(dir)
  return { inner, store: new DedupFileStore(inner, index) }
}

const owner = () => `o${Math.random().toString(36).slice(2, 10)}`

describe.each(indexes)('DedupFileStore with %s', (_name, open) => {
  it('keeps one copy of the same bytes under several keys, and deletes it with the last key', async () => {
    const { inner, store } = await stores(open())
    const me = owner()
    await store.write(`u/${me}/imports/1/figures/a.png`, Buffer.from('same picture'))
    await store.write(`u/${me}/copies/2/figure-1.png`, Buffer.from('same picture'))
    await store.write(`u/${me}/imports/1/pages/page-1.png`, Buffer.from('a page'))
    expect((await inner.list('blobs/')).length).toBe(2)
    expect((await store.read(`u/${me}/copies/2/figure-1.png`))?.toString()).toBe('same picture')
    expect(await store.list(`u/${me}/imports/1/`)).toEqual([`u/${me}/imports/1/figures/a.png`, `u/${me}/imports/1/pages/page-1.png`])
    expect(await store.usage(me)).toBe(2 * 12 + 6)
    expect((await store.sizes(`u/${me}/imports/1/`)).sort((a, b) => a.key.localeCompare(b.key))).toEqual([
      { key: `u/${me}/imports/1/figures/a.png`, size: 12 },
      { key: `u/${me}/imports/1/pages/page-1.png`, size: 6 },
    ])

    await store.remove([`u/${me}/imports/1/figures/a.png`])
    expect((await store.read(`u/${me}/copies/2/figure-1.png`))?.toString()).toBe('same picture')
    expect((await inner.list('blobs/')).length).toBe(2)
    await store.remove([`u/${me}/copies/2/figure-1.png`])
    expect(await store.read(`u/${me}/copies/2/figure-1.png`)).toBeNull()
    expect((await inner.list('blobs/')).length).toBe(1)
    expect(await store.usage(me)).toBe(6)
  })

  it('drops the old bytes when a key is written again with new ones', async () => {
    const { inner, store } = await stores(open())
    const key = `u/${owner()}/imports/1/results.json`
    await store.write(key, '{"v":1}')
    await store.write(key, '{"v":2}')
    expect((await store.read(key))?.toString()).toBe('{"v":2}')
    expect((await inner.list('blobs/')).length).toBe(1)
  })

  it('still reads, lists and removes files written before it', async () => {
    const { inner, store } = await stores(open())
    const key = `u/${owner()}/imports/old/pages/page-1.png`
    await inner.write(key, Buffer.from('old'))
    expect((await store.read(key))?.toString()).toBe('old')
    expect(await store.list(key.replace(/pages.*/, ''))).toEqual([key])
    await store.remove([key])
    expect(await inner.read(key)).toBeNull()
  })
})

describe('ownerOfKey', () => {
  it('reads the account from the key', () => {
    expect(ownerOfKey('u/abc/imports/1/a.png')).toBe('abc')
    expect(ownerOfKey('imports/1/a.png')).toBeNull()
  })
})
