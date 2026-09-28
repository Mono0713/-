import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { DraftExam, DraftQuestion, ExamMeta } from '@exam/core'
import type { BankQuestion, ImportRecord, NewImport, QuestionQuery } from './types.ts'

/** Storage for imports and questions. SQLite now; a Postgres version can implement the same interface for hosting. */
export interface Bank {
  createImport(input: NewImport): ImportRecord
  getImport(id: string): ImportRecord | null
  listImports(ownerId: string): ImportRecord[]
  updateImport(id: string, patch: Partial<Pick<ImportRecord, 'status' | 'progress' | 'error' | 'title' | 'subject' | 'provider' | 'model'>>): void
  deleteImport(id: string): void
  getDraft(importId: string): DraftExam | null
  saveDraft(importId: string, draft: DraftExam): void
  /** Replaces the questions an import put in the bank with these. */
  saveQuestions(importId: string, meta: ExamMeta, questions: DraftQuestion[]): BankQuestion[]
  listQuestions(query: QuestionQuery): { items: BankQuestion[]; total: number }
  getQuestion(id: string): BankQuestion | null
  updateQuestion(id: string, question: DraftQuestion & { subject?: string | null }): BankQuestion | null
  deleteQuestion(id: string): void
  subjects(ownerId: string): string[]
  close(): void
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS imports (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  page_count INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  status TEXT NOT NULL,
  progress_done INTEGER NOT NULL DEFAULT 0,
  progress_total INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  title TEXT,
  subject TEXT,
  draft TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS imports_owner ON imports (owner_id, created_at);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  import_id TEXT REFERENCES imports (id) ON DELETE SET NULL,
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  subject TEXT,
  exam_title TEXT,
  search_text TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS questions_owner ON questions (owner_id, created_at);
CREATE INDEX IF NOT EXISTS questions_import ON questions (import_id, position);
`

type Row = Record<string, string | number | null>

export class SqliteBank implements Bank {
  private readonly db: DatabaseSync

  /** `path` is a file, or ":memory:" for tests. */
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
    this.db.exec(SCHEMA)
  }

  createImport(input: NewImport): ImportRecord {
    const now = new Date().toISOString()
    const id = randomUUID()
    this.db
      .prepare(`INSERT INTO imports (id, owner_id, file_name, page_count, provider, model, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'processing', ?, ?)`)
      .run(id, input.ownerId, input.fileName, input.pageCount, input.provider, input.model, now, now)
    return this.getImport(id)!
  }

  getImport(id: string): ImportRecord | null {
    const row = this.db.prepare(`${IMPORT_SELECT} WHERE i.id = ?`).get(id) as Row | undefined
    return row ? toImport(row) : null
  }

  listImports(ownerId: string): ImportRecord[] {
    return (this.db.prepare(`${IMPORT_SELECT} WHERE i.owner_id = ? ORDER BY i.created_at DESC`).all(ownerId) as Row[]).map(toImport)
  }

  updateImport(id: string, patch: Parameters<Bank['updateImport']>[1]): void {
    const columns: Record<string, string | number | null> = {}
    if (patch.status !== undefined) columns.status = patch.status
    if (patch.progress !== undefined) {
      columns.progress_done = patch.progress.done
      columns.progress_total = patch.progress.total
    }
    if (patch.error !== undefined) columns.error = patch.error
    if (patch.title !== undefined) columns.title = patch.title
    if (patch.subject !== undefined) columns.subject = patch.subject
    if (patch.provider !== undefined) columns.provider = patch.provider
    if (patch.model !== undefined) columns.model = patch.model
    this.setColumns('imports', id, columns)
  }

  deleteImport(id: string): void {
    this.db.prepare('DELETE FROM imports WHERE id = ?').run(id)
  }

  getDraft(importId: string): DraftExam | null {
    const row = this.db.prepare('SELECT draft FROM imports WHERE id = ?').get(importId) as Row | undefined
    return row?.draft ? (JSON.parse(String(row.draft)) as DraftExam) : null
  }

  saveDraft(importId: string, draft: DraftExam): void {
    this.setColumns('imports', importId, { draft: JSON.stringify(draft), title: draft.meta.title, subject: draft.meta.subject })
  }

  saveQuestions(importId: string, meta: ExamMeta, questions: DraftQuestion[]): BankQuestion[] {
    const imp = this.getImport(importId)
    if (!imp) throw new Error(`import ${importId} not found`)
    const now = new Date().toISOString()
    const insert = this.db.prepare(`INSERT INTO questions
      (id, owner_id, import_id, position, type, subject, exam_title, search_text, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    this.db.exec('BEGIN')
    try {
      this.db.prepare('DELETE FROM questions WHERE import_id = ?').run(importId)
      questions.forEach((q, position) => {
        insert.run(randomUUID(), imp.ownerId, importId, position, q.type, meta.subject, meta.title, searchText(q), JSON.stringify(q), now, now)
      })
      this.setColumns('imports', importId, { status: 'saved' })
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
    return this.listQuestions({ ownerId: imp.ownerId, importId, limit: questions.length || 1 }).items
  }

  listQuestions(query: QuestionQuery): { items: BankQuestion[]; total: number } {
    const where = ['owner_id = ?']
    const params: (string | number)[] = [query.ownerId]
    if (query.search?.trim()) {
      where.push('search_text LIKE ?')
      params.push(`%${query.search.trim().toLowerCase()}%`)
    }
    if (query.type) {
      where.push('type = ?')
      params.push(query.type)
    }
    if (query.subject) {
      where.push('subject = ?')
      params.push(query.subject)
    }
    if (query.importId) {
      where.push('import_id = ?')
      params.push(query.importId)
    }
    const clause = where.join(' AND ')
    const total = Number((this.db.prepare(`SELECT COUNT(*) AS n FROM questions WHERE ${clause}`).get(...params) as Row).n)
    const order = query.importId ? 'position' : 'created_at DESC, position'
    const rows = this.db
      .prepare(`SELECT * FROM questions WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...params, query.limit ?? 50, query.offset ?? 0) as Row[]
    return { items: rows.map(toQuestion), total }
  }

  getQuestion(id: string): BankQuestion | null {
    const row = this.db.prepare('SELECT * FROM questions WHERE id = ?').get(id) as Row | undefined
    return row ? toQuestion(row) : null
  }

  updateQuestion(id: string, question: DraftQuestion & { subject?: string | null }): BankQuestion | null {
    const { subject, ...q } = question as DraftQuestion & { subject?: string | null } & Partial<BankQuestion>
    for (const key of ['id', 'ownerId', 'importId', 'examTitle', 'createdAt', 'updatedAt'] as const) delete q[key]
    const columns: Record<string, string | null> = { type: q.type, search_text: searchText(q), data: JSON.stringify(q) }
    if (subject !== undefined) columns.subject = subject
    this.setColumns('questions', id, columns)
    return this.getQuestion(id)
  }

  deleteQuestion(id: string): void {
    this.db.prepare('DELETE FROM questions WHERE id = ?').run(id)
  }

  subjects(ownerId: string): string[] {
    const rows = this.db
      .prepare('SELECT DISTINCT subject FROM questions WHERE owner_id = ? AND subject IS NOT NULL ORDER BY subject')
      .all(ownerId) as Row[]
    return rows.map((r) => String(r.subject))
  }

  close(): void {
    this.db.close()
  }

  private setColumns(table: 'imports' | 'questions', id: string, columns: Record<string, string | number | null>) {
    const keys = Object.keys(columns)
    if (!keys.length) return
    const sets = [...keys.map((k) => `${k} = ?`), 'updated_at = ?'].join(', ')
    this.db.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...Object.values(columns), new Date().toISOString(), id)
  }
}

const IMPORT_SELECT = `SELECT i.*, (SELECT COUNT(*) FROM questions q WHERE q.import_id = i.id) AS question_count FROM imports i`

function toImport(row: Row): ImportRecord {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    fileName: String(row.file_name),
    pageCount: Number(row.page_count),
    provider: String(row.provider),
    model: row.model === null ? null : String(row.model),
    status: String(row.status) as ImportRecord['status'],
    progress: { done: Number(row.progress_done), total: Number(row.progress_total) },
    error: row.error === null ? null : String(row.error),
    title: row.title === null ? null : String(row.title),
    subject: row.subject === null ? null : String(row.subject),
    questionCount: Number(row.question_count ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function toQuestion(row: Row): BankQuestion {
  return {
    ...(JSON.parse(String(row.data)) as DraftQuestion),
    id: String(row.id),
    ownerId: String(row.owner_id),
    importId: row.import_id === null ? null : String(row.import_id),
    subject: row.subject === null ? null : String(row.subject),
    examTitle: row.exam_title === null ? null : String(row.exam_title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function searchText(q: DraftQuestion): string {
  return [q.number, q.stem, q.translation, ...q.options.map((o) => o.content), ...q.answer.values, q.explanation]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}
