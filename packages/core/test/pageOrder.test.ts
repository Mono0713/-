import { describe, expect, it } from 'vitest'
import { guessPageOrder, inverseOrder, isPageOrder, reorderDraftPages, type DraftExam, type DraftQuestion } from '../src/index.ts'
import { question } from './fixtures.ts'

const box = { x: 0, y: 0, width: 1, height: 0.1 }
const q = (number: string, pages: number[]): DraftQuestion => {
  const { continuesFromPreviousPage: _a, continuesOnNextPage: _b, bbox: _c, ...rest } = question({ number })
  return { ...rest, figures: [], locations: pages.map((pageNumber) => ({ pageNumber, bbox: box })) }
}
const exam = (questions: DraftQuestion[]): DraftExam => ({
  fileName: 'x',
  meta: { title: null, subject: null, institution: null, term: null, language: null },
  groups: [],
  questions,
  pages: [1, 2, 3].map((pageNumber) => ({ pageNumber, provider: 'p', model: 'm', notes: null })),
})

describe('page order', () => {
  it('checks and undoes an order', () => {
    expect(isPageOrder([2, 3, 1], 3)).toBe(true)
    expect(isPageOrder([2, 2, 1], 3)).toBe(false)
    expect(isPageOrder([1, 2], 3)).toBe(false)
    expect(inverseOrder([2, 3, 1])).toEqual([3, 1, 2])
  })

  it('moves page numbers and puts the questions in the order of their pages', () => {
    const { draft, questionOrder } = reorderDraftPages(exam([q('10', [1]), q('11', []), q('1', [2]), q('5', [3])]), [2, 1, 3])
    expect(draft.questions.map((x) => [x.number, x.locations.map((l) => l.pageNumber)])).toEqual([['1', [1]], ['10', [2]], ['11', []], ['5', [3]]])
    expect(questionOrder).toEqual([2, 0, 1, 3])
    expect(draft.pages.map((p) => p.pageNumber)).toEqual([1, 2, 3])
  })

  it('guesses the order from question numbers only when they tell', () => {
    expect(guessPageOrder([['10', '11'], ['1', '2(1)', '2(2)'], ['20']])).toEqual([2, 1, 3])
    // a question running onto the next page is numbered on both
    expect(guessPageOrder([['5', '6'], ['1', '5']])).toEqual([2, 1])
    expect(guessPageOrder([['1', '2'], ['3']])).toBeNull()
    // numbering starts over in a later section
    expect(guessPageOrder([['11', '12'], ['1', '10'], ['1', '3']])).toBeNull()
    expect(guessPageOrder([['2'], ['一']])).toBeNull()
  })
})
