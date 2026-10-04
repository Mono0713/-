import { afterAll, describe, expect, it } from 'vitest'
import type { DraftQuestion } from '@exam/core'
import { answerKind, buildItems, displayLabel, grade, gradeItem, inOtherLanguage, isOver, matches, PostgresQuizStore, SqliteQuizStore, summarize, toQuizLabels, type QuizSettings, type QuizStore } from '../src/index.ts'
import { testDatabase } from '@exam/db'

function q(overrides: Partial<DraftQuestion> = {}): DraftQuestion {
  return {
    number: '1', section: null, groupId: null, type: 'single_choice', stem: 'Pick one', translation: null,
    options: ['A', 'B', 'C', 'D'].map((label) => ({ label, content: `option ${label}` })), answer: { values: ['C'], source: 'printed' },
    explanation: null, points: 2, figures: [], confidence: 'high', issues: [], locations: [],
    ...overrides,
  }
}

const settings: QuizSettings = { mode: 'exam', shuffleQuestions: false, shuffleOptions: false, timeLimitMinutes: null }
/** Deterministic "random" numbers for shuffles. */
const sequence = (...values: number[]) => {
  let i = 0
  return () => values[i++ % values.length]!
}

describe('grade', () => {
  it('marks choice questions as all or nothing', () => {
    expect(grade(q(), { values: ['C'] })).toEqual({ status: 'correct', score: 2, max: 2 })
    expect(grade(q(), { values: ['A'] })).toEqual({ status: 'wrong', score: 0, max: 2 })
    expect(grade(q(), null)).toEqual({ status: 'unanswered', score: 0, max: 2 })
    const multi = q({ type: 'multiple_choice', answer: { values: ['A', 'C'], source: 'printed' } })
    expect(grade(multi, { values: ['C', 'A'] }).status).toBe('correct')
    expect(grade(multi, { values: ['A'] }).status).toBe('wrong')
  })

  it('marks true/false', () => {
    const tf = q({ type: 'true_false', options: [], answer: { values: ['false'], source: 'handwritten' }, points: null })
    expect(grade(tf, { values: ['false'] })).toEqual({ status: 'correct', score: 1, max: 1 })
    expect(grade(tf, { values: ['true'] }).status).toBe('wrong')
  })

  it('gives partial credit per blank and forgives case, width and label order', () => {
    const fill = q({ type: 'fill_in_blank', options: [], points: 4, answer: { values: ['E', 'Merozoites', 'D, E, F', '10^7 or 8x10^6'], source: 'handwritten' } })
    expect(grade(fill, { values: ['ｅ', ' merozoites ', 'F、D、E', '8x10^6'] })).toEqual({ status: 'correct', score: 4, max: 4 })
    expect(grade(fill, { values: ['E', 'x', '', ''] })).toEqual({ status: 'partial', score: 1, max: 4 })
    expect(grade(fill, { values: ['', '', '', ''] }).status).toBe('unanswered')
  })

  it('waits for the person to mark open answers', () => {
    const essay = q({ type: 'essay', options: [], answer: { values: ['Because…'], source: 'printed' }, points: 10 })
    expect(grade(essay, { values: ['my answer'] })).toEqual({ status: 'pending', score: 0, max: 10 })
    expect(grade(essay, { values: ['my answer'] }, { credit: 1, by: 'self', feedback: null })).toEqual({ status: 'correct', score: 10, max: 10 })
    expect(grade(essay, { values: ['my answer'] }, { credit: 0, by: 'self', feedback: null }).score).toBe(0)
  })

  it('takes partial credit from a grader such as an AI teacher', () => {
    const essay = q({ type: 'essay', options: [], answer: { values: ['Because…'], source: 'printed' }, points: 10 })
    expect(grade(essay, { values: ['my answer'] }, { credit: 0.65, by: 'ai', feedback: '少了一個原因' })).toEqual({ status: 'partial', score: 6.5, max: 10 })
    expect(grade(essay, { values: ['my answer'] }, { credit: 3, by: 'ai', feedback: null }).score).toBe(10)
  })

  it('waits for handwriting to be read, and grades what was read like typing', () => {
    const fill = q({ type: 'fill_in_blank', options: [], answer: { values: ['\\frac{1}{2}'], source: 'printed' }, points: 2 })
    const ink = { strokes: [{ points: [[0.1, 0.1, 0.5]] as [number, number, number][], color: '#000', size: 0.004 }], height: 0.3 }
    expect(grade(fill, { values: [], handwriting: ink })).toEqual({ status: 'pending', score: 0, max: 2 })
    expect(grade(fill, { values: [], handwriting: { strokes: [], height: 0.3 } }).status).toBe('unanswered')
    expect(grade(fill, { values: ['$0.5$'], handwriting: ink, transcribed: true }).status).toBe('correct')
  })

  it('does not count questions without an answer key', () => {
    expect(grade(q({ answer: { values: [], source: 'none' } }), { values: ['A'] })).toEqual({ status: 'no_key', score: 0, max: 0 })
  })
})

describe('matches', () => {
  it('compares written answers loosely', () => {
    expect(matches('(B)', 'b')).toBe(true)
    expect(matches('Anopheles', 'anopheles.')).toBe(true)
    expect(matches('Anopheles', 'Aedes')).toBe(false)
    expect(matches('1/2', '1/2')).toBe(true)
  })
})

describe('answerKind', () => {
  it('uses one input per figure blank or answer entry', () => {
    const figure = { description: 'd', bbox: { x: 0, y: 0, width: 1, height: 1 }, pageNumber: 1, image: null, blanks: [1, 2, 3].map((n) => ({ label: String(n), bbox: { x: 0, y: 0, width: 0.1, height: 0.1 }, ink: null, printedText: null })) }
    expect(answerKind(q({ type: 'fill_in_blank', options: [], figures: [figure], answer: { values: ['a', 'b', 'c'], source: 'printed' } }))).toEqual({ kind: 'blanks', count: 3, figureBlanks: 3 })
    expect(answerKind(q({ type: 'matching', answer: { values: ['A, B', 'C'], source: 'printed' } }))).toEqual({ kind: 'blanks', count: 2, figureBlanks: 0 })
    expect(answerKind(q({ type: 'calculation', options: [] }))).toEqual({ kind: 'text' })
    expect(answerKind(q({ type: 'single_choice', options: [] }))).toEqual({ kind: 'text' })
  })
})

describe('buildItems', () => {
  const sources = [q({ number: '1' }), q({ number: '2', type: 'fill_in_blank', options: [{ label: 'A', content: 'x' }, { label: 'B', content: 'y' }] })].map((question, i) => ({
    questionId: `q${i}`,
    question,
    group: null,
  }))

  it('keeps the paper order unless asked to shuffle', () => {
    const items = buildItems(sources, settings)
    expect(items.map((i) => i.questionId)).toEqual(['q0', 'q1'])
    expect(items[0]!.optionOrder).toEqual(['A', 'B', 'C', 'D'])
  })

  it('shuffles questions and relabels shuffled options', () => {
    const items = buildItems(sources, { ...settings, shuffleQuestions: true, shuffleOptions: true }, sequence(0, 0, 0, 0))
    expect(items.map((i) => i.questionId)).toEqual(['q1', 'q0'])
    const choice = items[1]!
    expect(choice.optionOrder).toEqual(['B', 'C', 'D', 'A'])
    expect(choice.displayLabels).toEqual(['A', 'B', 'C', 'D'])
    expect(displayLabel(choice, 'C')).toBe('B')
    expect(items[0]!.optionOrder).toEqual(['B', 'A'])
  })

  it('grades blanks answered with the shuffled labels', () => {
    const fill = q({
      type: 'fill_in_blank',
      options: ['A', 'B', 'C'].map((label) => ({ label, content: `word ${label}` })),
      answer: { values: ['A', 'C', 'A, B', 'free text'], source: 'printed' },
      points: 4,
    })
    const [item] = buildItems([{ questionId: 'q', question: fill, group: null }], { ...settings, shuffleOptions: true }, sequence(0, 0))
    expect(item!.optionOrder).toEqual(['B', 'C', 'A'])
    // Shown as A=B, B=C, C=A, so the paper's A is typed as C.
    expect(toQuizLabels(item!, 'A, B')).toBe('C, A')
    expect(gradeItem(item!, { values: ['C', 'b', 'a、c', 'free text'] }).status).toBe('correct')
    expect(gradeItem(item!, { values: ['A', 'C', 'A, B', 'free text'] }).score).toBe(1)
  })
})

describe('summarize and isOver', () => {
  it('adds up a finished attempt', () => {
    const items = buildItems(
      [q(), q({ type: 'essay', options: [], answer: { values: ['x'], source: 'printed' }, points: 5 })].map((question, i) => ({ questionId: `q${i}`, question, group: null })),
      settings,
    )
    const summary = summarize({ items, responses: [{ values: ['C'] }, { values: ['text'] }], markings: [null, null] })
    expect(summary).toMatchObject({ score: 2, max: 7, correct: 1, pending: 1 })
  })

  it('ends a timed exam at its deadline', () => {
    const deadline = new Date('2026-01-01T10:00:00Z').toISOString()
    expect(isOver({ finishedAt: null, deadline }, new Date('2026-01-01T09:59:59Z'))).toBe(false)
    expect(isOver({ finishedAt: null, deadline }, new Date('2026-01-01T10:00:00Z'))).toBe(true)
    expect(isOver({ finishedAt: null, deadline: null })).toBe(false)
  })
})

const pg = await testDatabase()
afterAll(() => pg?.drop())

const stores: [string, () => QuizStore][] = [['SqliteQuizStore', () => new SqliteQuizStore(':memory:')]]
if (pg) stores.push(['PostgresQuizStore', () => new PostgresQuizStore(pg.sql)])

describe.each(stores)('%s', (_name, open) => {
  it('keeps attempts per owner', async () => {
    const store = open()
    const attempt = await store.create({
      ownerId: 'local', title: '期中考', examIds: ['e1'], settings, items: [], responses: [], markings: [], checked: [],
      startedAt: new Date().toISOString(), deadline: null, finishedAt: null,
    })
    await store.save({ ...attempt, finishedAt: new Date().toISOString() })
    expect((await store.get(attempt.id))?.finishedAt).not.toBeNull()
    expect(await store.list('local')).toHaveLength(1)
    expect(await store.list('someone-else')).toHaveLength(0)
    await store.delete(attempt.id)
    expect(await store.get(attempt.id)).toBeNull()
    expect(await store.get('not-an-id')).toBeNull()
  })

  it('applies updates made at the same moment one after the other', async () => {
    const store = open()
    const attempt = await store.create({
      ownerId: 'local', title: 't', examIds: [], settings, items: [], responses: [null, null, null], markings: [], checked: [],
      startedAt: new Date().toISOString(), deadline: null, finishedAt: null,
    })
    await Promise.all(
      [0, 1, 2].map((i) => store.update(attempt.id, (a) => ({ ...a, responses: a.responses.map((r, j) => (j === i ? { values: [String(i)] } : r)) }))),
    )
    expect((await store.get(attempt.id))!.responses).toEqual([{ values: ['0'] }, { values: ['1'] }, { values: ['2'] }])
    expect(await store.update(attempt.id, () => null)).toMatchObject({ id: attempt.id })
    expect(await store.update('missing', (a) => a)).toBeNull()
  })
})

describe('inOtherLanguage', () => {
  const q = (stem: string, options: string[] = []) => ({ stem, options: options.map((content, i) => ({ label: String(i + 1), content })) })
  it('offers a translation for English to a Chinese reader, and the other way round', () => {
    expect(inOtherLanguage(q('What are euchromatin and heterochromatin?'), 'zh-Hant')).toBe(true)
    expect(inOtherLanguage(q('什麼是表觀遺傳？'), 'zh-Hant')).toBe(false)
    expect(inOtherLanguage(q('什麼是表觀遺傳？'), 'en')).toBe(true)
    expect(inOtherLanguage(q('What is DNA?'), 'en')).toBe(false)
  })
  it('ignores formulas and single letters', () => {
    expect(inOtherLanguage(q('計算 $\\sin x + \\cos x$', ['$x = 1$', '$x = 2$']), 'zh-Hant')).toBe(false)
    expect(inOtherLanguage(q('$2x + 3 = 7$'), 'zh-Hant')).toBe(false)
  })
})
