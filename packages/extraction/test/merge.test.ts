import { describe, expect, it } from 'vitest'
import { keepEdits, mergePages, type PageResult } from '../src/index.ts'
import { page, question } from '../../core/test/fixtures.ts'

function result(pageNumber: number, extracted: PageResult['page'], error: string | null = null): PageResult {
  return { pageNumber, provider: 'fake', model: 'fake-1', page: extracted, error, attempts: 1, usage: { inputTokens: null, outputTokens: null } }
}

describe('mergePages', () => {
  it('hands a word box (選詞填空) to each of its sentences', () => {
    const box = [{ label: '(A)', content: 'memorial' }, { label: 'B', content: 'diligent' }]
    const sentence = (number: string, answer: string) =>
      question({ number, groupId: 'g1', type: 'fill_in_blank', stem: `I like the ___ ${number}.`, options: [], answer: { values: [answer], source: 'handwritten' } })
    const exam = mergePages('exam.pdf', [result(1, page([sentence('1', '(B)'), sentence('2', 'A')], { groups: [{ id: 'g1', stem: '', figures: [], options: box }] }))])
    expect(exam.groups[0]!.options).toEqual([{ label: 'A', content: 'memorial' }, { label: 'B', content: 'diligent' }])
    expect(exam.questions.map((q) => [q.options.length, q.answer.values[0]])).toEqual([[2, 'B'], [2, 'A']])
  })

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
    expect(exam.pages[0]?.notes).toBe('extraction failed: timeout')
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

describe('keepEdits', () => {
  const moved = { x: 0.3, y: 0.5, width: 0.4, height: 0.2 }
  const one = result(1, page([question({ number: '1' }), question({ number: '2' })]))

  it('keeps what was edited on other pages when one more page is read', () => {
    const before = mergePages('exam.pdf', [one, result(2, null, 'quota')])
    before.questions[0]!.stem = 'edited by hand'
    before.questions[1]!.locations = [{ pageNumber: 1, bbox: moved, manual: true }]
    const after = keepEdits(before, mergePages('exam.pdf', [one, result(2, page([question({ number: '3' })]))]), new Set([2]))
    expect(after.questions.map((q) => q.number)).toEqual(['1', '2', '3'])
    expect(after.questions[0]!.stem).toBe('edited by hand')
    expect(after.questions[1]!.locations).toEqual([{ pageNumber: 1, bbox: moved, manual: true }])
    expect(after.questions[2]!.locations[0]!.pageNumber).toBe(2)
  })

  it('keeps a hand-placed box on a page read again', () => {
    const before = mergePages('exam.pdf', [one])
    before.questions[1]!.locations = [{ pageNumber: 1, bbox: moved, manual: true }]
    const after = keepEdits(before, mergePages('exam.pdf', [one]), new Set([1]))
    expect(after.questions[1]!.locations).toEqual([{ pageNumber: 1, bbox: moved, manual: true }])
    expect(after.questions[0]!.locations[0]!.manual).toBeUndefined()
  })

  it('joins the new part of a question that runs onto the page read', () => {
    const first = result(1, page([question({ number: '1', stem: 'Part one', options: [], continuesOnNextPage: true })]))
    const before = mergePages('exam.pdf', [first, result(2, null, 'quota')])
    before.questions[0]!.locations = [{ pageNumber: 1, bbox: moved, manual: true }]
    const second = result(2, page([question({ number: '1', stem: 'part two', continuesFromPreviousPage: true }), question({ number: '2' })]))
    const after = keepEdits(before, mergePages('exam.pdf', [first, second]), new Set([2]))
    expect(after.questions.map((q) => q.number)).toEqual(['1', '2'])
    expect(after.questions[0]!.stem).toBe('Part one\n\npart two')
    expect(after.questions[0]!.locations.map((l) => [l.pageNumber, l.manual ?? false])).toEqual([[1, true], [2, false]])
  })

  it('keeps questions added by hand where they were', () => {
    const before = mergePages('exam.pdf', [one])
    before.questions.unshift({ ...before.questions[0]!, number: 'new', locations: [] })
    const after = keepEdits(before, mergePages('exam.pdf', [one]), new Set([1]))
    expect(after.questions.map((q) => q.number)).toEqual(['new', '1', '2'])
  })
})
