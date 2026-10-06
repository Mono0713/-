import { describe, expect, it } from 'vitest'
import type { DraftQuestion } from '@exam/core'
import { buildItems, type QuizAttempt, type QuizSettings, type QuizSource } from '@exam/quiz'
import { assignmentStats, distribution, optionStats, typeRates, type Member } from '../src/index.ts'

function q(number: string, overrides: Partial<DraftQuestion> = {}): DraftQuestion {
  return {
    number,
    section: null,
    groupId: null,
    type: 'single_choice',
    stem: 'Pick one',
    translation: null,
    options: ['A', 'B'].map((label) => ({ label, content: label })),
    answer: { values: ['A'], source: 'printed' },
    explanation: null,
    points: 1,
    figures: [],
    confidence: 'high',
    issues: [],
    locations: [],
    ...overrides,
  }
}

const sources: QuizSource[] = [
  { questionId: 'q1', question: q('1'), group: null },
  { questionId: 'q2', question: q('2', { type: 'short_answer', options: [], answer: { values: ['photosynthesis makes sugar'], source: 'printed' } }), group: null },
]
const settings: QuizSettings = { mode: 'exam', shuffleQuestions: false, shuffleOptions: false, timeLimitMinutes: null }
const member = (userId: string, role: Member['role'] = 'student'): Member => ({ classId: 'c', userId, role, name: userId.toUpperCase(), joinedAt: '2026-10-01T00:00:00Z' })

function attempt(ownerId: string, startedAt: string, answers: string[][], finished: boolean, markings: QuizAttempt['markings'] = [null, null]): QuizAttempt {
  // the student saw the questions in the other order
  const items = buildItems([...sources].reverse(), settings)
  return {
    id: `${ownerId}-${startedAt}`,
    ownerId,
    title: 'A',
    examIds: [],
    settings,
    items,
    responses: [...answers].reverse().map((values) => ({ values })),
    markings: [...markings].reverse(),
    checked: [false, false],
    startedAt,
    deadline: null,
    finishedAt: finished ? startedAt : null,
  }
}

describe('assignmentStats', () => {
  it('counts the last handed-in attempt of each student and rates each question', () => {
    const stats = assignmentStats(
      sources,
      [member('t', 'teacher'), member('amy'), member('bo'), member('cy')],
      [
        attempt('amy', '2026-10-02T01:00:00Z', [['B'], ['no idea']], true, [null, { credit: 0, by: 'ai', feedback: null }]),
        attempt('amy', '2026-10-02T02:00:00Z', [['A'], ['sugar']], true, [null, { credit: 1, by: 'teacher', feedback: 'ok', replaced: { by: 'ai', credit: 0.5 } }]),
        attempt('bo', '2026-10-02T03:00:00Z', [['B'], ['']], true),
        attempt('cy', '2026-10-02T04:00:00Z', [['A'], []], false),
      ],
    )
    expect(stats.students.map((s) => [s.name, s.tries, s.counted?.handedIn, s.counted?.score])).toEqual([
      ['AMY', 2, true, 2],
      ['BO', 1, true, 0],
      ['CY', 1, false, 1],
    ])
    expect(stats.handedIn).toBe(2)
    expect(stats.average).toBe(0.5)
    expect(stats.questions).toEqual([
      { questionId: 'q1', number: '1', rate: 0.5, answered: 2 },
      { questionId: 'q2', number: '2', rate: 0.5, answered: 1 },
    ])
    expect([stats.aiMarked, stats.overridden]).toEqual([1, 1])
  })

  it('lists students who have not started', () => {
    const stats = assignmentStats(sources, [member('amy')], [])
    expect(stats.students).toEqual([{ userId: 'amy', name: 'AMY', left: false, tries: 0, counted: null }])
    expect(stats.average).toBeNull()
    expect(stats.questions[0]!.rate).toBeNull()
  })

  it('keeps the work of students who left the class', () => {
    const stats = assignmentStats(sources, [member('amy')], [attempt('dee', '2026-10-02T01:00:00Z', [['A'], ['sugar']], true)])
    expect(stats.students.map((s) => [s.userId, s.name, s.left, s.counted?.handedIn])).toEqual([
      ['amy', 'AMY', false, undefined],
      ['dee', '', true, true],
    ])
    expect(stats.handedIn).toBe(1)
  })
})

describe('charts', () => {
  const attempts = [
    attempt('amy', '2026-10-02T02:00:00Z', [['A'], ['sugar']], true, [null, { credit: 1, by: 'teacher', feedback: null }]),
    attempt('bo', '2026-10-02T03:00:00Z', [['B'], ['']], true),
    attempt('cy', '2026-10-02T04:00:00Z', [[], ['x']], true, [null, { credit: 0.5, by: 'ai', feedback: null }]),
  ]
  const stats = assignmentStats(sources, [member('amy'), member('bo'), member('cy')], attempts)

  it('spreads the scores into bands with the summary numbers', () => {
    const d = distribution(stats.students)
    expect(d.count).toBe(3)
    expect([d.bands[0], d.bands[2], d.bands[9]]).toEqual([1, 1, 1])
    expect([d.lowest, d.median, d.highest]).toEqual([0, 0.25, 1])
  })

  it('counts the options picked, by stored label, with blanks apart', () => {
    expect(optionStats(sources, stats.counted)).toEqual([
      {
        questionId: 'q1',
        number: '1',
        stem: 'Pick one',
        options: [
          { label: 'A', content: 'A', picked: 1, correct: true },
          { label: 'B', content: 'B', picked: 1, correct: false },
        ],
        blank: 1,
      },
    ])
  })

  it('rates each question type, weakest first', () => {
    expect(typeRates(stats.counted)).toEqual([
      { type: 'single_choice', score: 1, max: 3 },
      { type: 'short_answer', score: 1.5, max: 3 },
    ])
  })
})
