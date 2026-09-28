import type { QuizItem } from '@exam/quiz'

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

export function revealedItem(item: QuizItem): QuizItem {
  return item
}
