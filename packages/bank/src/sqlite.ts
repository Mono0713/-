import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import type { DraftExam, DraftQuestion, ExamMeta } from '@exam/core'
import { draftFields, META_KEYS, searchText, type Bank, type ImportPatch } from './bank.ts'
import type { BankExam, BankQuestion, ExamQuery, ImportRecord, NewExam, NewImport, QuestionQuery } from './types.ts'

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
  keep_original INTEGER NOT NULL DEFAULT 0,
  original_deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS imports_owner ON imports (owner_id, created_at);
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  import_id TEXT REFERENCES imports (id) ON DELETE SET NULL,
  title TEXT,
  subject TEXT,
  institution TEXT,
  term TEXT,
  language TEXT,
  groups TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS exams_owner ON exams (owner_id, created_at);
CREATE INDEX IF NOT EXISTS exams_import ON exams (import_id);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  exam_id TEXT REFERENCES exams (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  search_text TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS questions_owner ON questions (owner_id, created_at);
`

type Row = Record<string, string | number | null>

/** The SQLite implementation, synchronous underneath; `SqliteBank` exposes it through the async `Bank` interface. */
class SqliteBankSync {
  private readonly db: DatabaseSync

  /** `path` is a file, or ":memory:" for tests. */
  constructor(path: string) {
    this.db = new DatabaseSync(path)
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
    this.db.exec(SCHEMA)
    this.migrate()
    this.addImportColumns()
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

  updateImport(id: string, patch: ImportPatch): void {
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
    if (patch.keepOriginal !== undefined) columns.keep_original = patch.keepOriginal ? 1 : 0
    if (patch.originalDeletedAt !== undefined) columns.original_deleted_at = patch.originalDeletedAt
    this.setColumns('imports', id, columns)
  }

  originalsToExpire(savedBefore: Date): ImportRecord[] {
    const rows = this.db
      .prepare(`${IMPORT_SELECT} WHERE i.keep_original = 0 AND i.original_deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM exams e WHERE e.import_id = i.id AND e.created_at < ?)`)
      .all(savedBefore.toISOString()) as Row[]
    return rows.map(toImport)
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

  saveExam(importId: string, draft: DraftExam): BankExam {
    const imp = this.getImport(importId)
    if (!imp) throw new Error(`import ${importId} not found`)
    const now = new Date().toISOString()
    this.db.exec('BEGIN')
    try {
      let examId = this.examForImport(importId)?.id
      if (!examId) {
        examId = randomUUID()
        this.db
          .prepare('INSERT INTO exams (id, owner_id, import_id, groups, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .run(examId, imp.ownerId, importId, '[]', now, now)
      }
      this.setColumns('exams', examId, { ...metaColumns(draft.meta), groups: JSON.stringify(draft.groups) })
      this.db.prepare('DELETE FROM questions WHERE exam_id = ?').run(examId)
      this.insertQuestions(imp.ownerId, examId, draft.questions, now)
      this.setColumns('imports', importId, { status: 'saved' })
      this.db.exec('COMMIT')
      return this.getExam(examId)!
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  createExam(ownerId: string, exam: NewExam): BankExam {
    const now = new Date().toISOString()
    const id = randomUUID()
    this.db.exec('BEGIN')
    try {
      this.db.prepare('INSERT INTO exams (id, owner_id, import_id, groups, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?)').run(id, ownerId, JSON.stringify(exam.groups), now, now)
      this.setColumns('exams', id, metaColumns(exam.meta))
      this.insertQuestions(ownerId, id, exam.questions, now)
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
    return this.getExam(id)!
  }

  examForImport(importId: string): BankExam | null {
    const row = this.db.prepare(`${EXAM_SELECT} WHERE e.import_id = ?`).get(importId) as Row | undefined
    return row ? toExam(row) : null
  }

  listExams(query: ExamQuery): BankExam[] {
    const where = ['e.owner_id = ?']
    const params: string[] = [query.ownerId]
    if (query.search?.trim()) {
      const like = `%${query.search.trim().toLowerCase()}%`
      where.push('(LOWER(COALESCE(e.title, \'\')) LIKE ? OR EXISTS (SELECT 1 FROM questions q WHERE q.exam_id = e.id AND q.search_text LIKE ?))')
      params.push(like, like)
    }
    if (query.subject) {
      where.push('e.subject = ?')
      params.push(query.subject)
    }
    const rows = this.db.prepare(`${EXAM_SELECT} WHERE ${where.join(' AND ')} ORDER BY e.created_at DESC`).all(...params) as Row[]
    return rows.map(toExam)
  }

  getExam(id: string): BankExam | null {
    const row = this.db.prepare(`${EXAM_SELECT} WHERE e.id = ?`).get(id) as Row | undefined
    return row ? toExam(row) : null
  }

  updateExam(id: string, meta: Partial<ExamMeta>): BankExam | null {
    this.setColumns('exams', id, metaColumns(meta))
    return this.getExam(id)
  }

  deleteExam(id: string): void {
    this.db.prepare('DELETE FROM exams WHERE id = ?').run(id)
  }

  listQuestions(query: QuestionQuery): { items: BankQuestion[]; total: number } {
    const where = ['q.owner_id = ?']
    const params: (string | number)[] = [query.ownerId]
    if (query.search?.trim()) {
      where.push('q.search_text LIKE ?')
      params.push(`%${query.search.trim().toLowerCase()}%`)
    }
    if (query.type) {
      where.push('q.type = ?')
      params.push(query.type)
    }
    if (query.subject) {
      where.push('e.subject = ?')
      params.push(query.subject)
    }
    if (query.examId) {
      where.push('q.exam_id = ?')
      params.push(query.examId)
    }
    const clause = where.join(' AND ')
    const total = Number((this.db.prepare(`SELECT COUNT(*) AS n ${QUESTION_FROM} WHERE ${clause}`).get(...params) as Row).n)
    const order = query.examId ? 'q.position' : 'e.created_at DESC, q.position'
    const rows = this.db
      .prepare(`${QUESTION_SELECT} WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(...params, query.limit ?? 50, query.offset ?? 0) as Row[]
    return { items: rows.map(toQuestion), total }
  }

  getQuestion(id: string): BankQuestion | null {
    const row = this.db.prepare(`${QUESTION_SELECT} WHERE q.id = ?`).get(id) as Row | undefined
    return row ? toQuestion(row) : null
  }

  getQuestions(ids: string[]): BankQuestion[] {
    if (!ids.length) return []
    const rows = this.db.prepare(`${QUESTION_SELECT} WHERE q.id IN (${ids.map(() => '?').join(', ')})`).all(...ids) as Row[]
    const byId = new Map(rows.map((r) => [String(r.id), toQuestion(r)]))
    return ids.flatMap((id) => byId.get(id) ?? [])
  }

  updateQuestion(id: string, question: DraftQuestion): BankQuestion | null {
    const q = draftFields(question)
    this.setColumns('questions', id, { type: q.type, search_text: searchText(q), data: JSON.stringify(q) })
    return this.getQuestion(id)
  }

  deleteQuestion(id: string): void {
    this.db.prepare('DELETE FROM questions WHERE id = ?').run(id)
  }

  subjects(ownerId: string): string[] {
    const rows = this.db
      .prepare('SELECT DISTINCT subject FROM exams WHERE owner_id = ? AND subject IS NOT NULL ORDER BY subject')
      .all(ownerId) as Row[]
    return rows.map((r) => String(r.subject))
  }

  close(): void {
    this.db.close()
  }

  private insertQuestions(ownerId: string, examId: string, questions: DraftQuestion[], now: string) {
    const insert = this.db.prepare(`INSERT INTO questions (id, owner_id, exam_id, position, type, search_text, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    questions.forEach((q, position) => insert.run(randomUUID(), ownerId, examId, position, q.type, searchText(q), JSON.stringify(q), now, now))
  }

  /**
   * Version 1 filed questions directly under imports. Version 2 adds exams:
   * each import's saved questions become one exam, keeping their order.
   */
  private migrate() {
    const version = Number((this.db.prepare('PRAGMA user_version').get() as Row).user_version)
    if (version >= 2) return
    const columns = (this.db.prepare('PRAGMA table_info(questions)').all() as Row[]).map((c) => String(c.name))
    this.db.exec('BEGIN')
    try {
      if (!columns.includes('exam_id')) {
        this.db.exec('ALTER TABLE questions ADD COLUMN exam_id TEXT REFERENCES exams (id) ON DELETE CASCADE')
      }
      if (columns.includes('import_id')) {
        const groups = this.db
          .prepare(`SELECT owner_id, import_id, exam_title, subject, MIN(created_at) AS created_at
            FROM questions WHERE exam_id IS NULL GROUP BY owner_id, import_id, exam_title, subject`)
          .all() as Row[]
        for (const g of groups) {
          const id = randomUUID()
          const importId = g.import_id === null ? null : String(g.import_id)
          const draft = importId ? this.getDraft(importId) : null
          const meta = draft?.meta ?? { title: g.exam_title as string | null, subject: g.subject as string | null }
          this.db
            .prepare('INSERT INTO exams (id, owner_id, import_id, groups, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
            .run(id, String(g.owner_id), importId && this.getImport(importId) ? importId : null, JSON.stringify(draft?.groups ?? []), String(g.created_at), String(g.created_at))
          this.setColumns('exams', id, metaColumns({ ...meta, title: (g.exam_title as string | null) ?? meta.title, subject: (g.subject as string | null) ?? meta.subject }))
          this.db
            .prepare(`UPDATE questions SET exam_id = ? WHERE exam_id IS NULL AND owner_id = ? AND import_id IS ? AND exam_title IS ? AND subject IS ?`)
            .run(id, g.owner_id ?? null, g.import_id ?? null, g.exam_title ?? null, g.subject ?? null)
        }
      }
      this.db.exec('CREATE INDEX IF NOT EXISTS questions_exam ON questions (exam_id, position)')
      this.db.exec('PRAGMA user_version = 2')
      this.db.exec('COMMIT')
    } catch (err) {
      this.db.exec('ROLLBACK')
      throw err
    }
  }

  /** Columns added after the first release, for data folders made before them. */
  private addImportColumns() {
    const columns = (this.db.prepare('PRAGMA table_info(imports)').all() as Row[]).map((c) => String(c.name))
    if (!columns.includes('keep_original')) this.db.exec('ALTER TABLE imports ADD COLUMN keep_original INTEGER NOT NULL DEFAULT 0')
    if (!columns.includes('original_deleted_at')) this.db.exec('ALTER TABLE imports ADD COLUMN original_deleted_at TEXT')
  }

  private setColumns(table: 'imports' | 'exams' | 'questions', id: string, columns: Record<string, string | number | null>) {
    const keys = Object.keys(columns)
    if (!keys.length) return
    const sets = [...keys.map((k) => `${k} = ?`), 'updated_at = ?'].join(', ')
    this.db.prepare(`UPDATE ${table} SET ${sets} WHERE id = ?`).run(...Object.values(columns), new Date().toISOString(), id)
  }
}

const IMPORT_SELECT = `SELECT i.*, (SELECT COUNT(*) FROM questions q JOIN exams e ON e.id = q.exam_id WHERE e.import_id = i.id) AS question_count FROM imports i`
const EXAM_SELECT = `SELECT e.*, (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS question_count FROM exams e`
const QUESTION_FROM = 'FROM questions q JOIN exams e ON e.id = q.exam_id'
const QUESTION_SELECT = `SELECT q.id, q.owner_id, q.exam_id, q.position, q.data, q.created_at, q.updated_at, e.title AS exam_title, e.subject ${QUESTION_FROM}`

function metaColumns(meta: Partial<ExamMeta>): Record<string, string | null> {
  return Object.fromEntries(META_KEYS.filter((k) => meta[k] !== undefined).map((k) => [k, meta[k] ?? null]))
}

const text = (v: string | number | null | undefined) => (v === null || v === undefined ? null : String(v))

function toExam(row: Row): BankExam {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    importId: text(row.import_id),
    title: text(row.title),
    subject: text(row.subject),
    institution: text(row.institution),
    term: text(row.term),
    language: text(row.language),
    groups: JSON.parse(String(row.groups ?? '[]')) as DraftExam['groups'],
    questionCount: Number(row.question_count ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

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
    keepOriginal: Boolean(row.keep_original),
    originalDeletedAt: text(row.original_deleted_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function toQuestion(row: Row): BankQuestion {
  return {
    ...(JSON.parse(String(row.data)) as DraftQuestion),
    id: String(row.id),
    ownerId: String(row.owner_id),
    examId: String(row.exam_id),
    position: Number(row.position),
    subject: text(row.subject),
    examTitle: text(row.exam_title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}


/** Local storage in one SQLite file (or ":memory:" for tests). */
export class SqliteBank implements Bank {
  private readonly db: SqliteBankSync

  constructor(path: string) {
    this.db = new SqliteBankSync(path)
  }

  async createImport(input: NewImport) { return this.db.createImport(input) }
  async getImport(id: string) { return this.db.getImport(id) }
  async listImports(ownerId: string) { return this.db.listImports(ownerId) }
  async updateImport(id: string, patch: ImportPatch) { this.db.updateImport(id, patch) }
  async originalsToExpire(savedBefore: Date) { return this.db.originalsToExpire(savedBefore) }
  async deleteImport(id: string) { this.db.deleteImport(id) }
  async getDraft(importId: string) { return this.db.getDraft(importId) }
  async saveDraft(importId: string, draft: DraftExam) { this.db.saveDraft(importId, draft) }
  async saveExam(importId: string, draft: DraftExam) { return this.db.saveExam(importId, draft) }
  async createExam(ownerId: string, exam: NewExam) { return this.db.createExam(ownerId, exam) }
  async examForImport(importId: string) { return this.db.examForImport(importId) }
  async listExams(query: ExamQuery) { return this.db.listExams(query) }
  async getExam(id: string) { return this.db.getExam(id) }
  async updateExam(id: string, meta: Partial<ExamMeta>) { return this.db.updateExam(id, meta) }
  async deleteExam(id: string) { this.db.deleteExam(id) }
  async listQuestions(query: QuestionQuery) { return this.db.listQuestions(query) }
  async getQuestion(id: string) { return this.db.getQuestion(id) }
  async getQuestions(ids: string[]) { return this.db.getQuestions(ids) }
  async updateQuestion(id: string, question: DraftQuestion) { return this.db.updateQuestion(id, question) }
  async deleteQuestion(id: string) { this.db.deleteQuestion(id) }
  async subjects(ownerId: string) { return this.db.subjects(ownerId) }
  async close() { this.db.close() }
}
