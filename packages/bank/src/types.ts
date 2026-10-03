import type { DraftExam, DraftQuestion, ExamMeta } from '@exam/core'

/**
 * processing: pages are being read by a model.
 * waiting:    manual mode, waiting for replies pasted from a chat app.
 * review:     draft ready for a person to check and edit.
 * saved:      questions are in the bank.
 * failed:     nothing could be read.
 */
export type ImportStatus = 'processing' | 'waiting' | 'review' | 'saved' | 'failed'

/** One uploaded exam file on its way into the bank. */
export interface ImportRecord {
  id: string
  ownerId: string
  fileName: string
  pageCount: number
  provider: string
  model: string | null
  status: ImportStatus
  /** Pages finished out of pages sent in the current run. */
  progress: { done: number; total: number }
  error: string | null
  title: string | null
  subject: string | null
  questionCount: number
  /** The uploaded files stay after the 30 days that follow saving to the bank. */
  keepOriginal: boolean
  /** When the uploaded files were deleted; page images stay. */
  originalDeletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface NewImport {
  ownerId: string
  fileName: string
  pageCount: number
  provider: string
  model: string | null
}

/**
 * An exam in the bank: the unit questions are filed under. Imports create exams;
 * later, courses and sharing attach here too.
 */
export interface BankExam extends ExamMeta {
  id: string
  ownerId: string
  /** The upload it came from, while that still exists. */
  importId: string | null
  /** Passages and figures shared by several of its questions. */
  groups: DraftExam['groups']
  questionCount: number
  createdAt: string
  updatedAt: string
}

export interface ExamQuery {
  ownerId: string
  /** Matches the exam title or any of its questions, case-insensitive. */
  search?: string
  subject?: string
}

/** A question in the bank: the reviewed draft plus the exam it belongs to. */
export interface BankQuestion extends DraftQuestion {
  id: string
  ownerId: string
  examId: string
  /** Position within its exam. */
  position: number
  /** Copied from the exam for display. */
  subject: string | null
  examTitle: string | null
  createdAt: string
  updatedAt: string
}

export interface QuestionQuery {
  ownerId: string
  /** Matches stem, options and answers, case-insensitive. */
  search?: string
  type?: string
  subject?: string
  examId?: string
  limit?: number
  offset?: number
}
