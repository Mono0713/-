import type { QuizItem, QuizSettings } from '@exam/quiz'

/**
 * What the quiz page may show before an answer is revealed: the question
 * without its answer key, explanation, translation or review notes.
 */
export function hiddenItem(item: QuizItem): QuizItem {
  return {
    ...item,
    // Empty entries keep the number of blanks without giving the answers away.
    question: { ...item.question, answer: { values: item.question.answer.values.map(() => ''), source: 'none' }, explanation: null, translation: null, issues: [] },
  }
}

/** The item once its answer may be shown: whole, unless the key stays hidden for good. */
export function revealedItem(item: QuizItem, settings: Pick<QuizSettings, 'keyHidden'>): QuizItem {
  return settings.keyHidden ? hiddenItem(item) : item
}
