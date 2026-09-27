import { describe, expect, it } from 'vitest'
import { mergePages, type PageResult } from '../src/index.ts'
import { page, question } from '../../core/test/fixtures.ts'

function result(pageNumber: number, extracted: PageResult['page'], error: string | null = null): PageResult {
  return { pageNumber, provider: 'fake', model: 'fake-1', page: extracted, error, attempts: 1, usage: { inputTokens: null, outputTokens: null } }
}

describe('mergePages', () => {
  it('joins a question that runs over a page break', () => {
    const exam = mergePages('exam.pdf', [
      result(1, page([question({ number: '1' }), question({ number: '2', stem: 'Part one', options: [], continuesOnNextPage: true })])),
      result(2, page([
        question({ number: '2', stem: 'part two', options: [{ label: 'A', content: 'x' }], continuesFromPreviousPage: true, confidence: 'low', issues: ['smudged'] }),
        question({ number: '3' }),
      ])),
    ])
    expect(exam.questions.map((q) => q.number)).toEqual(['1', '2', '3'])
    const q2 = exam.questions[1]!
    expect(q2.stem).toBe('Part one\n\npart two')
    expect(q2.options).toHaveLength(1)
    expect(q2.confidence).toBe('low')
    expect(q2.issues).toEqual(['smudged'])
    expect(q2.locations.map((l) => l.pageNumber)).toEqual([1, 2])
  })

  it('does not join when the previous page did not flag a continuation', () => {
    const exam = mergePages('exam.pdf', [
      result(1, page([question({ number: '1' })])),
      result(2, page([question({ number: '2', continuesFromPreviousPage: true })])),
    ])
    expect(exam.questions).toHaveLength(2)
  })

  it('keeps group ids unique across pages', () => {
    const group = { id: 'g1', stem: 'Passage', figures: [] }
    const exam = mergePages('exam.pdf', [
      result(1, page([question({ groupId: 'g1' })], { groups: [group] })),
      result(2, page([question({ groupId: 'g1' })], { groups: [group] })),
    ])
    expect(exam.groups.map((g) => g.id)).toEqual(['p1:g1', 'p2:g1'])
    expect(exam.questions.map((q) => q.groupId)).toEqual(['p1:g1', 'p2:g1'])
  })

  it('records failed pages and fills metadata from the first page that has it', () => {
    const exam = mergePages('exam.pdf', [
      result(1, null, 'timeout'),
      result(2, page([question()])),
    ])
    expect(exam.pages[0]?.notes).toBe('extraction failed: timeout')
    expect(exam.meta.subject).toBe('微積分')
    expect(exam.questions).toHaveLength(1)
  })
})
