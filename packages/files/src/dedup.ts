import { createHash } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { Sql } from '@exam/db'
import { checkKey, contentTypeOf, type FileStore } from './index.ts'

/** Where a key's bytes live: a blob shared by every key with the same content. */
export interface FileRef {
  key: string
  blob: string
  size: number
  /** The account the key belongs to ("u/<owner>/…"), for its storage use; null for keys outside an account. */
  owner: string | null
}

/** Which blob each key points at. SqliteFileIndex locally, PostgresFileIndex when hosted. */
export interface FileIndex {
  get(key: string): Promise<FileRef | null>
  /** Points the key at a blob; returns the blob it pointed at before, if another one. */
  put(ref: FileRef): Promise<string | null>
  /** Forgets the keys; returns the blobs they pointed at. */
  delete(keys: string[]): Promise<string[]>
  /** Whether any key still points at the blob. */
  used(blob: string): Promise<boolean>
  list(prefix: string): Promise<string[]>
  /** Bytes the owner's keys hold, each key counted in full even when its bytes are shared; null: keys outside any account. */
  usage(owner: string | null): Promise<number>
}

const OWNER = /^u\/([^/]+)\//

/** The account a file key belongs to, from its "u/<owner>/" start. */
export const ownerOfKey = (key: string): string | null => OWNER.exec(key)?.[1] ?? null

/**
 * Stores each distinct file once. Keys stay as they are for everyone using the store
 * (and for the checks on who may open them); the bytes live in "blobs/<sha256>.<ext>",
 * shared by every key with the same content: a shared exam copied to someone's bank,
 * an assignment's frozen figures, or the same photo uploaded twice. A blob is deleted
 * with the last key pointing at it. Keys written before this store keep their own file.
 */
export class DedupFileStore implements FileStore {
  constructor(
    private readonly inner: FileStore,
    private readonly index: FileIndex,
  ) {}

  async read(key: string): Promise<Buffer | null> {
    const ref = await this.index.get(checkKey(key))
    return this.inner.read(ref ? ref.blob : key)
  }

  async write(key: string, data: Buffer | string, contentType = contentTypeOf(key)): Promise<void> {
    checkKey(key)
    const bytes = typeof data === 'string' ? Buffer.from(data) : data
    const hash = createHash('sha256').update(bytes).digest('hex')
    const ext = /\.([a-z0-9]{1,5})$/i.exec(key)?.[1]?.toLowerCase()
    const blob = `blobs/${hash.slice(0, 2)}/${hash}${ext ? `.${ext}` : ''}`
    if (!(await this.index.used(blob))) await this.inner.write(blob, bytes, contentType)
    const before = await this.index.put({ key, blob, size: bytes.length, owner: ownerOfKey(key) })
    if (before) await this.drop([before])
  }

  async list(prefix: string): Promise<string[]> {
    const [indexed, own] = await Promise.all([this.index.list(prefix), this.inner.list(prefix)])
    return [...new Set([...indexed, ...own])].sort()
  }

  async remove(keys: string[]): Promise<void> {
    if (!keys.length) return
    const blobs = await this.index.delete(keys)
    await this.drop(blobs)
    // Keys from before deduplication have their own file.
    await this.inner.remove(keys)
  }

  async signedUrl(key: string, seconds?: number): Promise<string | null> {
    const ref = await this.index.get(checkKey(key))
    return this.inner.signedUrl(ref ? ref.blob : key, seconds)
  }

  /** Bytes an account's files hold; null: files outside any account (the single local user). */
  usage(owner: string | null): Promise<number> {
    return this.index.usage(owner)
  }

  private async drop(blobs: string[]): Promise<void> {
    const unused: string[] = []
    for (const blob of new Set(blobs)) if (!(await this.index.used(blob))) unused.push(blob)
    if (unused.length) await this.inner.remove(unused)
  }
}

type Row = Record<string, unknown>
const toRef = (r: Row): FileRef => ({ key: String(r.key), blob: String(r.blob), size: Number(r.size), owner: r.owner === null || r.owner === undefined ? null : String(r.owner) })
const likePrefix = (prefix: string) => `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

export class SqliteFileIndex implements FileIndex {
  private readonly db: DatabaseSync

  /** `path` can be the bank's database file, or ":memory:". */
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec(`CREATE TABLE IF NOT EXISTS file_refs (
      key TEXT PRIMARY KEY, blob TEXT NOT NULL, size INTEGER NOT NULL, owner TEXT, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS file_refs_blob ON file_refs (blob);
      CREATE INDEX IF NOT EXISTS file_refs_owner ON file_refs (owner);`)
  }

  async get(key: string): Promise<FileRef | null> {
    const row = this.db.prepare('SELECT * FROM file_refs WHERE key = ?').get(key) as Row | undefined
    return row ? toRef(row) : null
  }

  async put(ref: FileRef): Promise<string | null> {
    const before = await this.get(ref.key)
    this.db
      .prepare('INSERT INTO file_refs (key, blob, size, owner, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (key) DO UPDATE SET blob = excluded.blob, size = excluded.size, owner = excluded.owner')
      .run(ref.key, ref.blob, ref.size, ref.owner, new Date().toISOString())
    return before && before.blob !== ref.blob ? before.blob : null
  }

  async delete(keys: string[]): Promise<string[]> {
    const blobs: string[] = []
    for (const key of keys) {
      const row = this.db.prepare('DELETE FROM file_refs WHERE key = ? RETURNING blob').get(key) as Row | undefined
      if (row) blobs.push(String(row.blob))
    }
    return blobs
  }

  async used(blob: string): Promise<boolean> {
    return this.db.prepare('SELECT 1 FROM file_refs WHERE blob = ? LIMIT 1').get(blob) !== undefined
  }

  async list(prefix: string): Promise<string[]> {
    const rows = this.db.prepare("SELECT key FROM file_refs WHERE key LIKE ? ESCAPE '\\' ORDER BY key").all(likePrefix(prefix)) as Row[]
    return rows.map((r) => String(r.key))
  }

  async usage(owner: string | null): Promise<number> {
    const row = (
      owner === null ? this.db.prepare('SELECT COALESCE(SUM(size), 0) AS n FROM file_refs WHERE owner IS NULL').get() : this.db.prepare('SELECT COALESCE(SUM(size), 0) AS n FROM file_refs WHERE owner = ?').get(owner)
    ) as Row
    return Number(row.n)
  }
}

export class PostgresFileIndex implements FileIndex {
  constructor(private readonly sql: Sql) {}

  async get(key: string): Promise<FileRef | null> {
    const [row] = await this.sql`select * from file_refs where key = ${key}`
    return row ? toRef(row) : null
  }

  async put(ref: FileRef): Promise<string | null> {
    const [row] = await this.sql`with before as (select blob from file_refs where key = ${ref.key})
      insert into file_refs (key, blob, size, owner) values (${ref.key}, ${ref.blob}, ${ref.size}, ${ref.owner})
      on conflict (key) do update set blob = excluded.blob, size = excluded.size, owner = excluded.owner
      returning (select blob from before) as before`
    const before = row?.before === null || row?.before === undefined ? null : String(row.before)
    return before && before !== ref.blob ? before : null
  }

  async delete(keys: string[]): Promise<string[]> {
    if (!keys.length) return []
    const rows = await this.sql`delete from file_refs where key in ${this.sql(keys)} returning blob`
    return rows.map((r) => String(r.blob))
  }

  async used(blob: string): Promise<boolean> {
    const [row] = await this.sql`select 1 from file_refs where blob = ${blob} limit 1`
    return Boolean(row)
  }

  async list(prefix: string): Promise<string[]> {
    const rows = await this.sql`select key from file_refs where key like ${likePrefix(prefix)} order by key`
    return rows.map((r) => String(r.key))
  }

  async usage(owner: string | null): Promise<number> {
    const [row] = owner === null ? await this.sql`select coalesce(sum(size), 0)::bigint as n from file_refs where owner is null` : await this.sql`select coalesce(sum(size), 0)::bigint as n from file_refs where owner = ${owner}`
    return Number(row?.n ?? 0)
  }
}
