import type { DraftExam, DraftQuestion } from '@exam/core'
import type { BankExam, BankQuestion, ExamPatch, ExamQuery, ImportRecord, NewExam, NewImport, QuestionQuery } from './types.ts'

export type ImportPatch = Partial<Pick<ImportRecord, 'status' | 'progress' | 'error' | 'title' | 'subject' | 'provider' | 'model' | 'keepOriginal' | 'originalDeletedAt'>>

/**
 * Storage for imports, exams and questions. SqliteBank keeps them in a local file;
 * PostgresBank in a hosted database (Supabase). Callers check that the signed-in
 * person owns what they ask for: the bank itself trusts ids.
 */
export interface Bank {
  createImport(input: NewImport): Promise<ImportRecord>
  getImport(id: string): Promise<ImportRecord | null>
  listImports(ownerId: string): Promise<ImportRecord[]>
  updateImport(id: string, patch: ImportPatch): Promise<void>
  /** Imports of every owner first saved to the bank before a moment whose uploaded files are still there and not kept. */
  originalsToExpire(savedBefore: Date): Promise<ImportRecord[]>
  /** Marks every import still "processing" as failed with the error; for a server starting up, when no reading can be running. Returns how many. */
  failInterrupted(error: string): Promise<number>
  /** Removes the import; an exam saved from it stays in the bank. */
  deleteImport(id: string): Promise<void>
  getDraft(importId: string): Promise<DraftExam | null>
  saveDraft(importId: string, draft: DraftExam): Promise<void>
  /** Puts a reviewed draft in the bank as an exam. Saving the same import again replaces that exam's questions. */
  saveExam(importId: string, draft: DraftExam): Promise<BankExam>
  /** A new exam made from questions rather than an import, e.g. a copy of an exam someone shared. */
  createExam(ownerId: string, exam: NewExam): Promise<BankExam>
  /** The exam an import was saved as, if any. */
  examForImport(importId: string): Promise<BankExam | null>
  listExams(query: ExamQuery): Promise<BankExam[]>
  getExam(id: string): Promise<BankExam | null>
  updateExam(id: string, patch: ExamPatch): Promise<BankExam | null>
  /** Deletes the exam and its questions. */
  deleteExam(id: string): Promise<void>
  listQuestions(query: QuestionQuery): Promise<{ items: BankQuestion[]; total: number }>
  getQuestion(id: string): Promise<BankQuestion | null>
  getQuestions(ids: string[]): Promise<BankQuestion[]>
  updateQuestion(id: string, question: DraftQuestion): Promise<BankQuestion | null>
  deleteQuestion(id: string): Promise<void>
  subjects(ownerId: string): Promise<string[]>
  close(): Promise<void>
}

/** Words a question is found by, lower-cased. */
export function searchText(q: DraftQuestion): string {
  return [q.number, q.stem, q.translation, ...q.options.map((o) => o.content), ...q.answer.values, q.explanation]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

/** The question as stored: the draft fields only, without the bank's own. */
export function draftFields(question: DraftQuestion): DraftQuestion {
  const q = { ...question } as DraftQuestion & Partial<BankQuestion>
  for (const key of ['id', 'ownerId', 'examId', 'position', 'subject', 'examTitle', 'createdAt', 'updatedAt'] as const) delete q[key]
  return q
}

export const META_KEYS = ['title', 'subject', 'institution', 'term', 'language'] as const
