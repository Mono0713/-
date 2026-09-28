import type { DraftQuestion } from '@exam/core'

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

/** A question in the bank: the reviewed draft plus where it came from. */
export interface BankQuestion extends DraftQuestion {
  id: string
  ownerId: string
  importId: string | null
  /** Subject and exam title copied from the exam, so the question stands on its own. */
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
  importId?: string
  limit?: number
  offset?: number
}
