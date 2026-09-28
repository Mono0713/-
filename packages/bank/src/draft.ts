import type { DraftQuestion } from '@exam/core'
import type { BankQuestion } from './types.ts'

/** The question itself, without where it is kept in the bank. */
export function draftOf(q: BankQuestion): DraftQuestion {
  const { id: _id, ownerId: _owner, examId: _exam, position: _position, subject: _subject, examTitle: _title, createdAt: _created, updatedAt: _updated, ...question } = q
  return question
}
