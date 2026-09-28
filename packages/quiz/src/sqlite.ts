import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { QuizAttempt } from './types.ts'

/** Where quiz attempts are kept. SQLite now; another store can implement the same interface. */
export interface QuizStore {
  create(attempt: Omit<QuizAttempt, 'id'>): QuizAttempt
  get(id: string): QuizAttempt | null
  save(attempt: QuizAttempt): void
  list(ownerId: string): QuizAttempt[]
  delete(id: string): void
  close(): void
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

  create(attempt: Omit<QuizAttempt, 'id'>): QuizAttempt {
    const full = { ...attempt, id: randomUUID() }
    this.db
      .prepare('INSERT INTO quiz_attempts (id, owner_id, data, started_at, finished_at) VALUES (?, ?, ?, ?, ?)')
      .run(full.id, full.ownerId, JSON.stringify(full), full.startedAt, full.finishedAt)
    return full
  }

  get(id: string): QuizAttempt | null {
    const row = this.db.prepare('SELECT data FROM quiz_attempts WHERE id = ?').get(id) as Row | undefined
    return row ? (JSON.parse(String(row.data)) as QuizAttempt) : null
  }

  save(attempt: QuizAttempt): void {
    this.db.prepare('UPDATE quiz_attempts SET data = ?, finished_at = ? WHERE id = ?').run(JSON.stringify(attempt), attempt.finishedAt, attempt.id)
  }

  list(ownerId: string): QuizAttempt[] {
    const rows = this.db.prepare('SELECT data FROM quiz_attempts WHERE owner_id = ? ORDER BY started_at DESC').all(ownerId) as Row[]
    return rows.map((r) => JSON.parse(String(r.data)) as QuizAttempt)
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM quiz_attempts WHERE id = ?').run(id)
  }

  close(): void {
    this.db.close()
  }
}
