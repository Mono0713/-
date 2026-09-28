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

  it('joins an option cut by a page break', () => {
    const cut = [{ label: 'A', content: '能自動判斷' }, { label: 'E', content: '具模組功' }]
    const first = result(1, page([question({ number: '2', stem: 'Perl 的精神?', options: cut, continuesOnNextPage: true })]))
    const asOption = mergePages('exam.pdf', [
      first,
      result(2, page([question({ number: '2', stem: '', options: [{ label: '(E)', content: '能但不支援物件導向。' }], continuesFromPreviousPage: true })])),
    ])
    const asStem = mergePages('exam.pdf', [
      result(1, page([question({ number: '2', stem: 'Perl 的精神?', options: cut, continuesOnNextPage: true })])),
      result(2, page([question({ number: '2', stem: '能但不支援物件導向。', options: [], continuesFromPreviousPage: true })])),
    ])
    for (const exam of [asOption, asStem]) {
      const q = exam.questions[0]!
      expect(q.stem).toBe('Perl 的精神?')
      expect(q.options.map((o) => o.label)).toEqual(['A', 'E'])
      expect(q.options[1]!.content).toBe('具模組功能但不支援物件導向。')
    }
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
    expect(exam.pages[0]?.notes).toBe('辨識失敗：timeout')
    expect(exam.meta.subject).toBe('微積分')
    expect(exam.questions).toHaveLength(1)
  })
})

describe('mergePages clean-up', () => {
  it('strips brackets from option labels and choice answers', () => {
    const exam = mergePages('exam.pdf', [
      result(1, page([question({ options: [{ label: '(1)', content: 'NMR' }, { label: '（2）', content: 'X-ray' }], answer: { values: ['(2)'], source: 'printed' } })])),
    ])
    const q = exam.questions[0]!
    expect(q.options.map((o) => o.label)).toEqual(['1', '2'])
    expect(q.answer.values).toEqual(['2'])
  })

  it('drops an explanation that only repeats the answer', () => {
    const text = 'DNA wraps around histones.'
    const exam = mergePages('exam.pdf', [
      result(1, page([question({ type: 'essay', options: [], answer: { values: [text], source: 'printed' }, explanation: text })])),
    ])
    expect(exam.questions[0]!.explanation).toBeNull()
  })

  it('carries the section onto the next page and fills points from a per-question rule', () => {
    const exam = mergePages('exam.pdf', [
      result(1, page([question({ number: '1', section: '問答題（每題 25 分）', points: null })])),
      result(2, page([question({ number: '2', section: null, points: null })])),
    ])
    expect(exam.questions.map((q) => [q.section, q.points])).toEqual([
      ['問答題（每題 25 分）', 25],
      ['問答題（每題 25 分）', 25],
    ])
  })
})

describe('mergePages translations', () => {
  it('keeps translations and joins them across a page break', () => {
    const exam = mergePages('exam.pdf', [
      result(1, page([question({ stem: 'What is epigenetics?', translation: '什麼是表觀遺傳？', continuesOnNextPage: true })])),
      result(2, page([question({ stem: 'Explain.', translation: '請說明。', continuesFromPreviousPage: true })])),
    ])
    expect(exam.questions[0]!.translation).toBe('什麼是表觀遺傳？\n\n請說明。')
  })
})
