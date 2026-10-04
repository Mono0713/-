import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { QuizAttempt } from './types.ts'

/** Where quiz attempts are kept: SqliteQuizStore locally, PostgresQuizStore when hosted. */
export interface QuizStore {
  create(attempt: Omit<QuizAttempt, 'id'>): Promise<QuizAttempt>
  get(id: string): Promise<QuizAttempt | null>
  save(attempt: QuizAttempt): Promise<void>
  /**
   * Reads, changes and saves one attempt with nothing else saving it in between, so two
   * answers saved at the same moment cannot overwrite each other. `change` returns the
   * new attempt, or null to leave it as it is. Returns the attempt as stored afterwards.
   */
  update(id: string, change: (attempt: QuizAttempt) => QuizAttempt | null): Promise<QuizAttempt | null>
  list(ownerId: string): Promise<QuizAttempt[]>
  delete(id: string): Promise<void>
  close(): Promise<void>
}

type Row = Record<string, string | number | null>

export class SqliteQuizStore implements QuizStore {
  private readonly db: DatabaseSync

  /** `path` is a file (it can be the bank's), or ":memory:" for tests. */
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        data TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT
      );
      CREATE INDEX IF NOT EXISTS quiz_attempts_owner ON quiz_attempts (owner_id, started_at);`)
  }

  async create(attempt: Omit<QuizAttempt, 'id'>): Promise<QuizAttempt> {
    const full = { ...attempt, id: randomUUID() }
    this.db
      .prepare('INSERT INTO quiz_attempts (id, owner_id, data, started_at, finished_at) VALUES (?, ?, ?, ?, ?)')
      .run(full.id, full.ownerId, JSON.stringify(full), full.startedAt, full.finishedAt)
    return full
  }

  async get(id: string): Promise<QuizAttempt | null> {
    const row = this.db.prepare('SELECT data FROM quiz_attempts WHERE id = ?').get(id) as Row | undefined
    return row ? (JSON.parse(String(row.data)) as QuizAttempt) : null
  }

  async save(attempt: QuizAttempt): Promise<void> {
    this.db.prepare('UPDATE quiz_attempts SET data = ?, finished_at = ? WHERE id = ?').run(JSON.stringify(attempt), attempt.finishedAt, attempt.id)
  }

  async update(id: string, change: (attempt: QuizAttempt) => QuizAttempt | null): Promise<QuizAttempt | null> {
    // Synchronous from read to write, so no other request runs in between.
    const row = this.db.prepare('SELECT data FROM quiz_attempts WHERE id = ?').get(id) as Row | undefined
    if (!row) return null
    const current = JSON.parse(String(row.data)) as QuizAttempt
    const next = change(current)
    if (!next) return current
    this.db.prepare('UPDATE quiz_attempts SET data = ?, finished_at = ? WHERE id = ?').run(JSON.stringify(next), next.finishedAt, id)
    return next
  }

  async list(ownerId: string): Promise<QuizAttempt[]> {
    const rows = this.db.prepare('SELECT data FROM quiz_attempts WHERE owner_id = ? ORDER BY started_at DESC').all(ownerId) as Row[]
    return rows.map((r) => JSON.parse(String(r.data)) as QuizAttempt)
  }

  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM quiz_attempts WHERE id = ?').run(id)
  }

  async close(): Promise<void> {
    this.db.close()
  }
}
