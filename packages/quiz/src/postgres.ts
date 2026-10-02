import { randomUUID } from 'node:crypto'
import { isUuid, type Sql } from '@exam/db'
import type { QuizStore } from './sqlite.ts'
import type { QuizAttempt } from './types.ts'

/** Quiz attempts in Postgres (Supabase), one JSON document per attempt like SqliteQuizStore. */
export class PostgresQuizStore implements QuizStore {
  constructor(private readonly sql: Sql) {}

  async create(attempt: Omit<QuizAttempt, 'id'>): Promise<QuizAttempt> {
    const full = { ...attempt, id: randomUUID() }
    await this.sql`insert into quiz_attempts (id, owner_id, data, started_at, finished_at)
      values (${full.id}, ${full.ownerId}, ${this.sql.json(full as never)}, ${full.startedAt}, ${full.finishedAt})`
    return full
  }

  async get(id: string): Promise<QuizAttempt | null> {
    if (!isUuid(id)) return null
    const [row] = await this.sql`select data from quiz_attempts where id = ${id}`
    return (row?.data as QuizAttempt | undefined) ?? null
  }

  async save(attempt: QuizAttempt): Promise<void> {
    if (!isUuid(attempt.id)) return
    await this.sql`update quiz_attempts set data = ${this.sql.json(attempt as never)}, finished_at = ${attempt.finishedAt} where id = ${attempt.id}`
  }

  async update(id: string, change: (attempt: QuizAttempt) => QuizAttempt | null): Promise<QuizAttempt | null> {
    if (!isUuid(id)) return null
    return this.sql.begin(async (tx) => {
      // The row stays locked until the change is written.
      const [row] = await tx`select data from quiz_attempts where id = ${id} for update`
      if (!row) return null
      const current = row.data as QuizAttempt
      const next = change(current)
      if (!next) return current
      await tx`update quiz_attempts set data = ${tx.json(next as never)}, finished_at = ${next.finishedAt} where id = ${id}`
      return next
    })
  }

  async list(ownerId: string): Promise<QuizAttempt[]> {
    const rows = await this.sql`select data from quiz_attempts where owner_id = ${ownerId} order by started_at desc`
    return rows.map((r) => r.data as QuizAttempt)
  }

  async delete(id: string): Promise<void> {
    if (isUuid(id)) await this.sql`delete from quiz_attempts where id = ${id}`
  }

  /** The connection is shared with the other stores; whoever opened it closes it. */
  async close(): Promise<void> {}
}
