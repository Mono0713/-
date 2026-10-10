import { describe, expect, it } from 'vitest'
import { joinCarriedGroups, type DraftQuestion } from '../src/index.ts'

const q = (number: string, groupId: string | null): DraftQuestion => ({
  number, section: null, groupId, type: 'single_choice', stem: 'x', translation: null, options: [], answer: { values: [], source: 'none' },
  explanation: null, points: 1, figures: [], confidence: 'high', issues: [], locations: [],
})
const groups = [{ id: 'p1:g1', stem: 'A passage', figures: [], pageNumber: 1 }]

describe('joinCarriedGroups', () => {
  it('brings questions carried onto the next page back into their passage', () => {
    const out = joinCarriedGroups({ groups, questions: [q('3', 'p1:g1'), q('4', 'p2:g1'), q('5', 'p2:g1'), q('6', null)] })
    expect(out.questions.map((x) => x.groupId)).toEqual(['p1:g1', 'p1:g1', 'p1:g1', null])
  })

  it('brings the next sub-question back', () => {
    const out = joinCarriedGroups({ groups, questions: [q('11(a)', 'p1:g1'), q('11(b)', 'p2:g1')] })
    expect(out.questions[1]!.groupId).toBe('p1:g1')
  })

  it('leaves questions alone when the numbers do not follow or nothing is missing', () => {
    const apart = { groups, questions: [q('3', 'p1:g1'), q('1', 'p2:g1')] }
    expect(joinCarriedGroups(apart)).toBe(apart)
    const whole = { groups, questions: [q('3', 'p1:g1'), q('4', 'p1:g1'), q('5', null)] }
    expect(joinCarriedGroups(whole)).toBe(whole)
  })
})
