import type { BankExam, BankQuestion } from '@exam/bank'
import type { Share } from '@exam/sharing'
import { TOKEN } from '@exam/sharing'
import { services } from './context'

export interface OpenShare {
  share: Share
  exam: BankExam
  questions: BankQuestion[]
}

/** The exam behind an open link with its questions, or null when the link is wrong, closed or the exam gone. */
export async function openShare(token: string): Promise<OpenShare | null> {
  if (!TOKEN.test(token)) return null
  const { shares, bank } = services()
  const share = await shares.get(token)
  if (!share || share.closedAt) return null
  const exam = await bank.getExam(share.examId)
  if (!exam || exam.ownerId !== share.ownerId) return null
  const { items } = await bank.listQuestions({ ownerId: exam.ownerId, examId: exam.id, limit: 1000 })
  return { share, exam, questions: items }
}

const IMPORT_FILE = /^u\/([^/]+)\/imports\/([^/]+)\/(figures|pages)\//

/**
 * Whether a file of someone else may be served: figures and page images of an import
 * whose exam is shared by an open link. Anyone signed in with the link sees them anyway.
 */
export async function sharedFile(key: string): Promise<boolean> {
  const m = IMPORT_FILE.exec(key)
  if (!m) return false
  const { bank, shares } = services()
  const exam = await bank.examForImport(m[2]!)
  if (!exam || exam.ownerId !== m[1]) return false
  return (await shares.forExam(exam.id)) !== null
}
