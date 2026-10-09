import type { DraftExam, DraftFigure } from '@exam/core'
import { classFile } from './classes'
import { keyPrefixOf } from './context'
import { keepDraftFiles, keepQuestionFiles } from './fileKeys'
import { sharedFile } from './shared'

/**
 * Who may read a stored file. A question's pictures are file keys that come back from the browser
 * with every saved draft, so a key is never trusted because a question holds it: before a file is
 * served, copied or sent to an AI, it is checked here.
 */

/** Whether the file is one of the person's own (without accounts, every file is the one local person's). */
export const ownsFile = (ownerId: string, key: string): boolean => key.startsWith(keyPrefixOf(ownerId))

/** Whether the person may see the file: their own, an open shared exam's, or one of their classes' assignments'. */
export async function canReadFile(userId: string, key: string): Promise<boolean> {
  return ownsFile(userId, key) || (await sharedFile(key)) || (await classFile(key, userId))
}

/** A question from the browser, keeping only pictures that are the owner's own files. */
export const ownQuestionFiles = <T extends { figures: DraftFigure[] }>(ownerId: string, question: T): T => keepQuestionFiles(keyPrefixOf(ownerId), question)

/** A draft from the browser, keeping only pictures that are the owner's own files. */
export const ownDraftFiles = (ownerId: string, draft: DraftExam): DraftExam => keepDraftFiles(keyPrefixOf(ownerId), draft)
