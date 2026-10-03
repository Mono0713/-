import { randomBytes } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { iso, isUuid, type Sql } from '@exam/db'

/** When people who got the link see the answer key: once they hand in (or check a question), or never. */
export type AnswerRelease = 'after_submit' | 'never'

/** An exam opened to anyone with the link. Closing it kills the link; sharing again makes a new one. */
export interface Share {
  token: string
  examId: string
  ownerId: string
  answers: AnswerRelease
  /** Whether people with the link may add a copy to their own bank ("加到我的題庫"). */
  allowCopy: boolean
  createdAt: string
  closedAt: string | null
}

/**
 * Links to exams people share, and the copies others made of them ("加到我的題庫"), so
 * the shared page can open a copy already made and a copy remembers where it came from.
 */
export interface ShareStore {
  /**
   * The exam's open link, made now if there is none; `answers` is applied either way, and
   * `allowCopy` when given (a new link allows copies unless told otherwise).
   */
  open(examId: string, ownerId: string, answers: AnswerRelease, allowCopy?: boolean): Promise<Share>
  get(token: string): Promise<Share | null>
  /** The exam's open link, if any. */
  forExam(examId: string): Promise<Share | null>
  close(examId: string): Promise<void>
  recordCopy(token: string, ownerId: string, examId: string): Promise<void>
  /** Exams this person made from the link, newest first. */
  copies(token: string, ownerId: string): Promise<string[]>
}

/** 22 URL-safe characters: too many to guess. */
export function newToken(): string {
  return randomBytes(16).toString('base64url')
}

export const TOKEN = /^[A-Za-z0-9_-]{22}$/

type Row = Record<string, unknown>

export class SqliteShareStore implements ShareStore {
  private readonly db: DatabaseSync

  /** `path` can be the bank's database file, or ":memory:". */
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec(`CREATE TABLE IF NOT EXISTS exam_shares (
      token TEXT PRIMARY KEY, exam_id TEXT NOT NULL, owner_id TEXT NOT NULL, answers TEXT NOT NULL,
      created_at TEXT NOT NULL, closed_at TEXT)`)
    this.db.exec('CREATE INDEX IF NOT EXISTS exam_shares_exam ON exam_shares (exam_id)')
    // added after the table: older databases get the column, copies allowed as before
    if (!(this.db.prepare('PRAGMA table_info(exam_shares)').all() as Row[]).some((c) => c.name === 'allow_copy')) {
      this.db.exec('ALTER TABLE exam_shares ADD COLUMN allow_copy INTEGER NOT NULL DEFAULT 1')
    }
    this.db.exec(`CREATE TABLE IF NOT EXISTS share_copies (
      token TEXT NOT NULL, owner_id TEXT NOT NULL, exam_id TEXT NOT NULL, created_at TEXT NOT NULL)`)
    this.db.exec('CREATE INDEX IF NOT EXISTS share_copies_token ON share_copies (token, owner_id)')
  }

  async open(examId: string, ownerId: string, answers: AnswerRelease, allowCopy?: boolean): Promise<Share> {
    const open = await this.forExam(examId)
    if (open) {
      const copy = allowCopy ?? open.allowCopy
      this.db.prepare('UPDATE exam_shares SET answers = ?, allow_copy = ? WHERE token = ?').run(answers, copy ? 1 : 0, open.token)
      return { ...open, answers, allowCopy: copy }
    }
    const token = newToken()
    this.db
      .prepare('INSERT INTO exam_shares (token, exam_id, owner_id, answers, allow_copy, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(token, examId, ownerId, answers, (allowCopy ?? true) ? 1 : 0, new Date().toISOString())
    return (await this.get(token))!
  }

  async get(token: string): Promise<Share | null> {
    const row = this.db.prepare('SELECT * FROM exam_shares WHERE token = ?').get(token) as Row | undefined
    return row ? toShare(row) : null
  }

  async forExam(examId: string): Promise<Share | null> {
    const row = this.db.prepare('SELECT * FROM exam_shares WHERE exam_id = ? AND closed_at IS NULL ORDER BY created_at DESC').get(examId) as Row | undefined
    return row ? toShare(row) : null
  }

  async close(examId: string): Promise<void> {
    this.db.prepare('UPDATE exam_shares SET closed_at = ? WHERE exam_id = ? AND closed_at IS NULL').run(new Date().toISOString(), examId)
  }

  async recordCopy(token: string, ownerId: string, examId: string): Promise<void> {
    this.db.prepare('INSERT INTO share_copies (token, owner_id, exam_id, created_at) VALUES (?, ?, ?, ?)').run(token, ownerId, examId, new Date().toISOString())
  }

  async copies(token: string, ownerId: string): Promise<string[]> {
    const rows = this.db.prepare('SELECT exam_id FROM share_copies WHERE token = ? AND owner_id = ? ORDER BY created_at DESC, rowid DESC').all(token, ownerId) as Row[]
    return rows.map((r) => String(r.exam_id))
  }
}

export class PostgresShareStore implements ShareStore {
  constructor(private readonly sql: Sql) {}

  async open(examId: string, ownerId: string, answers: AnswerRelease, allowCopy?: boolean): Promise<Share> {
    const open = await this.forExam(examId)
    if (open) {
      const copy = allowCopy ?? open.allowCopy
      await this.sql`update exam_shares set answers = ${answers}, allow_copy = ${copy} where token = ${open.token}`
      return { ...open, answers, allowCopy: copy }
    }
    const token = newToken()
    await this.sql`insert into exam_shares (token, exam_id, owner_id, answers, allow_copy) values (${token}, ${examId}, ${ownerId}, ${answers}, ${allowCopy ?? true})`
    return (await this.get(token))!
  }

  async get(token: string): Promise<Share | null> {
    if (!TOKEN.test(token)) return null
    const [row] = await this.sql`select * from exam_shares where token = ${token}`
    return row ? toShare(row) : null
  }

  async forExam(examId: string): Promise<Share | null> {
    if (!isUuid(examId)) return null
    const [row] = await this.sql`select * from exam_shares where exam_id = ${examId} and closed_at is null order by created_at desc limit 1`
    return row ? toShare(row) : null
  }

  async close(examId: string): Promise<void> {
    if (!isUuid(examId)) return
    await this.sql`update exam_shares set closed_at = now() where exam_id = ${examId} and closed_at is null`
  }

  async recordCopy(token: string, ownerId: string, examId: string): Promise<void> {
    await this.sql`insert into share_copies (token, owner_id, exam_id) values (${token}, ${ownerId}, ${examId})`
  }

  async copies(token: string, ownerId: string): Promise<string[]> {
    const rows = await this.sql`select exam_id from share_copies where token = ${token} and owner_id = ${ownerId} order by created_at desc, id desc`
    return rows.map((r) => String(r.exam_id))
  }
}

function toShare(r: Row): Share {
  const at = (v: unknown) => (v === null || v === undefined ? null : v instanceof Date ? iso(v) : String(v))
  return {
    token: String(r.token),
    examId: String(r.exam_id),
    ownerId: String(r.owner_id),
    answers: String(r.answers) as AnswerRelease,
    // sqlite keeps 1/0, Postgres a boolean
    allowCopy: r.allow_copy === undefined || r.allow_copy === null ? true : Boolean(Number(r.allow_copy)),
    createdAt: at(r.created_at)!,
    closedAt: at(r.closed_at),
  }
}
