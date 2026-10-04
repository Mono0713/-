import type { QuizItem, QuizSettings } from '@exam/quiz'

/**
 * What the quiz page may show before an answer is revealed: the question
 * without its answer key, explanation, translation or review notes.
 */
export function hiddenItem(item: QuizItem): QuizItem {
  // The characters of a writing practice are what the student copies, not a secret.
  const values = item.question.type === 'writing' ? item.question.answer.values : item.question.answer.values.map(() => '')
  return {
    ...item,
    // Empty entries keep the number of blanks without giving the answers away.
    question: { ...item.question, answer: { values, source: 'none' }, explanation: null, translation: null, issues: [] },
  }
}

/** Whether the answer key may be shown now: not when it is kept private, or before the time it opens. */
export function keyShown(settings: Pick<QuizSettings, 'keyHidden' | 'keyUntil'>, now = new Date()): boolean {
  return !settings.keyHidden && !(settings.keyUntil && now < new Date(settings.keyUntil))
}

/** The item once its answer may be shown: whole, unless the key stays hidden for good or for now. */
export function revealedItem(item: QuizItem, settings: Pick<QuizSettings, 'keyHidden' | 'keyUntil'>): QuizItem {
  return keyShown(settings) ? item : hiddenItem(item)
}
