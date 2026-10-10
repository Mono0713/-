import { describe, expect, it } from 'vitest'
import type { DraftQuestion } from '@exam/core'
import { buildItems, grade, matches, needsTeacher, sameMath, withinTolerance } from '../src/index.ts'

describe('sameMath', () => {
  it('accepts every way of writing the same number', () => {
    for (const given of ['0.5', '1/2', '½', '50%', '\\frac{1}{2}', '$\\frac{1}{2}$', '2/4', 'x = 1/2']) expect(sameMath('\\frac{1}{2}', given), given).toBe(true)
    expect(sameMath('8\\times10^{6}', '8x10^6')).toBe(true)
    expect(sameMath('8 \\times 10^6', '8e6')).toBe(true)
    expect(sameMath('\\sqrt{2}', '2^(1/2)')).toBe(true)
    expect(sameMath('2\\pi', '2π')).toBe(true)
    expect(sameMath('x^2+1', 'x²+1')).toBe(true)
  })

  it('accepts a decimal rounded to two or more places', () => {
    expect(sameMath('\\frac{1}{3}', '0.33')).toBe(true)
    expect(sameMath('\\frac{1}{3}', '0.333')).toBe(true)
    expect(sameMath('\\frac{1}{3}', '0.3')).toBe(false)
    expect(sameMath('\\frac{1}{3}', '0.34')).toBe(false)
  })

  it('accepts the same expression written differently', () => {
    expect(sameMath('2x+1', '1 + 2*x')).toBe(true)
    expect(sameMath('(x+1)^2', 'x^2 + 2x + 1')).toBe(true)
    expect(sameMath('\\frac{x}{2}', '0.5x')).toBe(true)
    expect(sameMath('2x+1', '2x-1')).toBe(false)
    expect(sameMath('2x+1', '2y+1')).toBe(false)
  })

  it('leaves words, units and lists to other checks', () => {
    expect(sameMath('Merozoites', 'Merozoite')).toBe(false)
    expect(sameMath('5 cm', '5')).toBe(false)
    expect(sameMath('D, E, F', 'F, E, D')).toBe(false)
    expect(sameMath('', '')).toBe(false)
  })
})

function q(overrides: Partial<DraftQuestion>): DraftQuestion {
  return {
    number: '1', section: null, groupId: null, type: 'fill_in_blank', stem: 'Solve', translation: null, options: [],
    answer: { values: ['\\frac{1}{2}'], source: 'printed' }, explanation: null, points: 2, figures: [], confidence: 'high', issues: [], locations: [],
    ...overrides,
  }
}
const settings = { mode: 'exam', shuffleQuestions: false, shuffleOptions: false, timeLimitMinutes: null } as const

describe('grade with equivalent answers and markings', () => {
  it('marks a blank right whatever form the number takes', () => {
    expect(grade(q({}), { values: ['0.5'] }).status).toBe('correct')
  })

  it('marks a short calculation answer right without anyone checking', () => {
    const calc = q({ type: 'calculation', answer: { values: ['8 \\times 10^6'], source: 'printed' } })
    expect(grade(calc, { values: ['8e6'] }).status).toBe('correct')
    expect(grade(calc, { values: ['about 9 million'] }).status).toBe('pending')
  })

  it('lets a marking override a blank the key rejected, and count a question without a key', () => {
    expect(grade(q({}), { values: ['one half'] }, { credit: 1, by: 'ai', feedback: null }).status).toBe('correct')
    const noKey = q({ answer: { values: [], source: 'none' } })
    expect(grade(noKey, { values: ['7'] })).toEqual({ status: 'no_key', score: 0, max: 0 })
    expect(grade(noKey, { values: ['7'] }, { credit: 0.5, by: 'ai', feedback: null })).toEqual({ status: 'partial', score: 1, max: 2 })
  })

  it('sends only unsettled answers to a teacher', () => {
    const [blank, choice, essay] = buildItems(
      [q({}), q({ type: 'single_choice', options: [{ label: 'A', content: 'a' }, { label: 'B', content: 'b' }], answer: { values: ['A'], source: 'printed' } }), q({ type: 'essay', answer: { values: [], source: 'none' } })].map((question, i) => ({ questionId: String(i), question, group: null })),
      settings,
    )
    expect(needsTeacher(blank!, { values: ['0.5'] }, null)).toBe(false)
    expect(needsTeacher(blank!, { values: ['one half'] }, null)).toBe(true)
    expect(needsTeacher(choice!, { values: ['B'] }, null)).toBe(false)
    expect(needsTeacher(essay!, { values: ['my essay'] }, null)).toBe(true)
    expect(needsTeacher(essay!, { values: [''] }, null)).toBe(false)
    expect(needsTeacher(essay!, { values: ['my essay'] }, { credit: 1, by: 'self', feedback: null })).toBe(false)
  })

  it('does not ask about answers that are plainly wrong: another option label or another number', () => {
    const options = ['A', 'B', 'C'].map((label) => ({ label, content: label }))
    const [labels, number, calc] = buildItems(
      [
        q({ options, answer: { values: ['A', 'B'], source: 'printed' } }),
        q({ answer: { values: ['8 \\times 10^6'], source: 'printed' } }),
        q({ type: 'calculation', answer: { values: ['42'], source: 'printed' } }),
      ].map((question, i) => ({ questionId: String(i), question, group: null })),
      settings,
    )
    expect(needsTeacher(labels!, { values: ['C', 'B'] }, null)).toBe(false)
    expect(needsTeacher(labels!, { values: ['Liver', 'B'] }, null)).toBe(true)
    expect(needsTeacher(number!, { values: ['9e6'] }, null)).toBe(false)
    expect(needsTeacher(number!, { values: ['8 million'] }, null)).toBe(true)
    expect(needsTeacher(calc!, { values: ['41'] }, null)).toBe(false)
    expect(needsTeacher(calc!, { values: ['x = 6 × 7, so 42 apples'] }, null)).toBe(true)
  })
})

describe('withinTolerance', () => {
  it('accepts a number inside a ± or ~ range, with or without the unit', () => {
    expect(withinTolerance('98 ± 2', '97')).toBe(true)
    expect(withinTolerance('98 ± 2 %', '99.5%')).toBe(true)
    expect(withinTolerance('$75 \\pm 3$', '78')).toBe(true)
    expect(withinTolerance('98 ± 2', '95')).toBe(false)
    expect(withinTolerance('43 ~ 47 mmHg', '45 mmHg')).toBe(true)
    expect(withinTolerance('43～47', '48')).toBe(false)
    expect(withinTolerance('0.5 到 0.7', '0.6')).toBe(true)
    // not a range: left to the other rules
    expect(withinTolerance('45', '45')).toBe(false)
    expect(withinTolerance('increase', '45')).toBe(false)
  })

  it('counts in marking', () => {
    expect(matches('98 ± 2', '96.5')).toBe(true)
    expect(matches('98 ± 2', 'about 90')).toBe(false)
  })
})
