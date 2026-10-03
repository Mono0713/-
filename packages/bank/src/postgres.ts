import { randomUUID } from 'node:crypto'
import type { DraftExam, DraftQuestion, ExamMeta } from '@exam/core'
import { iso, isUuid, likePattern, type Sql, type TransactionSql } from '@exam/db'
import { draftFields, META_KEYS, searchText, type Bank, type ImportPatch } from './bank.ts'
import type { BankExam, BankQuestion, ExamQuery, ImportRecord, NewExam, NewImport, QuestionQuery } from './types.ts'

type Row = Record<string, unknown>

/**
 * The bank in Postgres (Supabase), for hosting. Same behaviour as SqliteBank;
 * the tables come from supabase/migrations.
 */
export class PostgresBank implements Bank {
  constructor(private readonly sql: Sql) {}

  async createImport(input: NewImport): Promise<ImportRecord> {
    const id = randomUUID()
    await this.sql`insert into imports (id, owner_id, file_name, page_count, provider, model, page_format, status)
      values (${id}, ${input.ownerId}, ${input.fileName}, ${input.pageCount}, ${input.provider}, ${input.model}, ${input.pageFormat ?? 'png'}, 'processing')`
    return (await this.getImport(id))!
  }

  async getImport(id: string): Promise<ImportRecord | null> {
    if (!isUuid(id)) return null
    const [row] = await this.sql`${this.importSelect()} where i.id = ${id}`
    return row ? toImport(row) : null
  }

  async listImports(ownerId: string): Promise<ImportRecord[]> {
    const rows = await this.sql`${this.importSelect()} where i.owner_id = ${ownerId} order by i.created_at desc`
    return rows.map(toImport)
  }

  async updateImport(id: string, patch: ImportPatch): Promise<void> {
    const columns: Row = {}
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
    if (patch.keepOriginal !== undefined) columns.keep_original = patch.keepOriginal
    if (patch.originalDeletedAt !== undefined) columns.original_deleted_at = patch.originalDeletedAt && new Date(patch.originalDeletedAt)
    await this.setColumns(this.sql, 'imports', id, columns)
  }

  async originalsToExpire(savedBefore: Date): Promise<ImportRecord[]> {
    const rows = await this.sql`${this.importSelect()} where not i.keep_original and i.original_deleted_at is null
      and exists (select 1 from exams e where e.import_id = i.id and e.created_at < ${savedBefore})`
    return rows.map(toImport)
  }

  async failInterrupted(error: string): Promise<number> {
    const rows = await this.sql`update imports set status = 'failed', error = ${error}, updated_at = now() where status = 'processing' returning id`
    return rows.length
  }

  async deleteImport(id: string): Promise<void> {
    if (isUuid(id)) await this.sql`delete from imports where id = ${id}`
  }

  async getDraft(importId: string): Promise<DraftExam | null> {
    if (!isUuid(importId)) return null
    const [row] = await this.sql`select draft from imports where id = ${importId}`
    return (row?.draft as DraftExam | null | undefined) ?? null
  }

  async saveDraft(importId: string, draft: DraftExam): Promise<void> {
    await this.setColumns(this.sql, 'imports', importId, { draft: this.sql.json(draft as never), title: draft.meta.title, subject: draft.meta.subject })
  }

  async saveExam(importId: string, draft: DraftExam): Promise<BankExam> {
    const imp = await this.getImport(importId)
    if (!imp) throw new Error(`import ${importId} not found`)
    const examId = await this.sql.begin(async (tx) => {
      // Locks the import so two saves of the same draft cannot both create an exam.
      await tx`select id from imports where id = ${importId} for update`
      const [existing] = await tx`select id from exams where import_id = ${importId}`
      const id = existing ? String(existing.id) : randomUUID()
      if (!existing) await tx`insert into exams (id, owner_id, import_id) values (${id}, ${imp.ownerId}, ${importId})`
      await this.setColumns(tx, 'exams', id, { ...metaColumns(draft.meta), groups: tx.json(draft.groups as never) })
      await tx`delete from questions where exam_id = ${id}`
      if (draft.questions.length) {
        const rows = draft.questions.map((q, position) => ({
          id: randomUUID(),
          owner_id: imp.ownerId,
          exam_id: id,
          position,
          type: q.type,
          search_text: searchText(q),
          data: tx.json(q as never),
        }))
        await tx`insert into questions ${tx(rows)}`
      }
      await this.setColumns(tx, 'imports', importId, { status: 'saved' })
      return id
    })
    return (await this.getExam(examId))!
  }

  async createExam(ownerId: string, exam: NewExam): Promise<BankExam> {
    const id = randomUUID()
    await this.sql.begin(async (tx) => {
      await tx`insert into exams (id, owner_id, import_id) values (${id}, ${ownerId}, null)`
      await this.setColumns(tx, 'exams', id, { ...metaColumns(exam.meta), groups: tx.json(exam.groups as never) })
      if (exam.questions.length) {
        const rows = exam.questions.map((q, position) => ({ id: randomUUID(), owner_id: ownerId, exam_id: id, position, type: q.type, search_text: searchText(q), data: tx.json(q as never) }))
        await tx`insert into questions ${tx(rows)}`
      }
    })
    return (await this.getExam(id))!
  }

  async examForImport(importId: string): Promise<BankExam | null> {
    if (!isUuid(importId)) return null
    const [row] = await this.sql`${this.examSelect()} where e.import_id = ${importId}`
    return row ? toExam(row) : null
  }

  async listExams(query: ExamQuery): Promise<BankExam[]> {
    const sql = this.sql
    const term = query.search?.trim().toLowerCase()
    const rows = await sql`${this.examSelect()} where e.owner_id = ${query.ownerId}
      ${term ? sql`and (coalesce(e.title, '') ilike ${likePattern(term)} or exists (select 1 from questions q where q.exam_id = e.id and q.search_text like ${likePattern(term)}))` : sql``}
      ${query.subject ? sql`and e.subject = ${query.subject}` : sql``}
      order by e.created_at desc`
    return rows.map(toExam)
  }

  async getExam(id: string): Promise<BankExam | null> {
    if (!isUuid(id)) return null
    const [row] = await this.sql`${this.examSelect()} where e.id = ${id}`
    return row ? toExam(row) : null
  }

  async updateExam(id: string, meta: Partial<ExamMeta>): Promise<BankExam | null> {
    await this.setColumns(this.sql, 'exams', id, metaColumns(meta))
    return this.getExam(id)
  }

  async deleteExam(id: string): Promise<void> {
    if (isUuid(id)) await this.sql`delete from exams where id = ${id}`
  }

  async listQuestions(query: QuestionQuery): Promise<{ items: BankQuestion[]; total: number }> {
    const sql = this.sql
    if (query.examId && !isUuid(query.examId)) return { items: [], total: 0 }
    const term = query.search?.trim().toLowerCase()
    const where = sql`where q.owner_id = ${query.ownerId}
      ${term ? sql`and q.search_text like ${likePattern(term)}` : sql``}
      ${query.type ? sql`and q.type = ${query.type}` : sql``}
      ${query.subject ? sql`and e.subject = ${query.subject}` : sql``}
      ${query.examId ? sql`and q.exam_id = ${query.examId}` : sql``}`
    const [count] = await sql`select count(*)::int as n from questions q join exams e on e.id = q.exam_id ${where}`
    const order = query.examId ? sql`order by q.position` : sql`order by e.created_at desc, q.position`
    const rows = await sql`${this.questionSelect()} ${where} ${order} limit ${query.limit ?? 50} offset ${query.offset ?? 0}`
    return { items: rows.map(toQuestion), total: Number(count?.n ?? 0) }
  }

  async getQuestion(id: string): Promise<BankQuestion | null> {
    if (!isUuid(id)) return null
    const [row] = await this.sql`${this.questionSelect()} where q.id = ${id}`
    return row ? toQuestion(row) : null
  }

  async getQuestions(ids: string[]): Promise<BankQuestion[]> {
    const valid = ids.filter(isUuid)
    if (!valid.length) return []
    const rows = await this.sql`${this.questionSelect()} where q.id in ${this.sql(valid)}`
    const byId = new Map(rows.map((r) => [String(r.id), toQuestion(r)]))
    return ids.flatMap((id) => byId.get(id) ?? [])
  }

  async updateQuestion(id: string, question: DraftQuestion): Promise<BankQuestion | null> {
    const q = draftFields(question)
    await this.setColumns(this.sql, 'questions', id, { type: q.type, search_text: searchText(q), data: this.sql.json(q as never) })
    return this.getQuestion(id)
  }

  async deleteQuestion(id: string): Promise<void> {
    if (isUuid(id)) await this.sql`delete from questions where id = ${id}`
  }

  async subjects(ownerId: string): Promise<string[]> {
    const rows = await this.sql`select distinct subject from exams where owner_id = ${ownerId} and subject is not null order by subject`
    return rows.map((r) => String(r.subject))
  }

  /** The connection is shared with the other stores; whoever opened it closes it. */
  async close(): Promise<void> {}

  private importSelect() {
    return this.sql`select i.*, (select count(*)::int from questions q join exams e on e.id = q.exam_id where e.import_id = i.id) as question_count from imports i`
  }

  private examSelect() {
    return this.sql`select e.*, (select count(*)::int from questions q where q.exam_id = e.id) as question_count from exams e`
  }

  private questionSelect() {
    return this.sql`select q.id, q.owner_id, q.exam_id, q.position, q.data, q.created_at, q.updated_at, e.title as exam_title, e.subject
      from questions q join exams e on e.id = q.exam_id`
  }

  private async setColumns(sql: Sql | TransactionSql, table: 'imports' | 'exams' | 'questions', id: string, columns: Row) {
    if (!Object.keys(columns).length || !isUuid(id)) return
    await sql`update ${sql(table)} set ${sql({ ...columns, updated_at: new Date() })} where id = ${id}`
  }
}

function metaColumns(meta: Partial<ExamMeta>): Record<string, string | null> {
  return Object.fromEntries(META_KEYS.filter((k) => meta[k] !== undefined).map((k) => [k, meta[k] ?? null]))
}

const text = (v: unknown) => (v === null || v === undefined ? null : String(v))

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
    groups: (row.groups ?? []) as DraftExam['groups'],
    questionCount: Number(row.question_count ?? 0),
    createdAt: iso(row.created_at as Date)!,
    updatedAt: iso(row.updated_at as Date)!,
  }
}

function toImport(row: Row): ImportRecord {
  return {
    id: String(row.id),
    ownerId: String(row.owner_id),
    fileName: String(row.file_name),
    pageCount: Number(row.page_count),
    provider: String(row.provider),
    model: text(row.model),
    status: String(row.status) as ImportRecord['status'],
    progress: { done: Number(row.progress_done), total: Number(row.progress_total) },
    error: text(row.error),
    title: text(row.title),
    subject: text(row.subject),
    questionCount: Number(row.question_count ?? 0),
    keepOriginal: Boolean(row.keep_original),
    originalDeletedAt: iso((row.original_deleted_at ?? null) as Date | null),
    pageFormat: row.page_format === 'webp' ? 'webp' : 'png',
    createdAt: iso(row.created_at as Date)!,
    updatedAt: iso(row.updated_at as Date)!,
  }
}

function toQuestion(row: Row): BankQuestion {
  return {
    ...(row.data as DraftQuestion),
    id: String(row.id),
    ownerId: String(row.owner_id),
    examId: String(row.exam_id),
    position: Number(row.position),
    subject: text(row.subject),
    examTitle: text(row.exam_title),
    createdAt: iso(row.created_at as Date)!,
    updatedAt: iso(row.updated_at as Date)!,
  }
}
