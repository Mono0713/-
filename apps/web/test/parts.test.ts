import type { DraftQuestion } from '@exam/core'
import { describe, expect, it } from 'vitest'
import { mergeParts, splitNumber, splitParts } from '../src/features/review/parts.ts'

const q = (overrides: Partial<DraftQuestion>): DraftQuestion => ({
  number: '11', section: null, groupId: null, type: 'calculation', stem: '', translation: null, options: [],
  answer: { values: [], source: 'none' }, explanation: null, points: 10, figures: [], confidence: 'high', issues: [],
  locations: [{ pageNumber: 2, bbox: { x: 0.1, y: 0.5, width: 0.8, height: 0.2 } }],
  ...overrides,
})

describe('splitParts', () => {
  it('splits (a) (b) into a group and one question per part, ignoring f(x)', () => {
    const result = splitParts(
      q({ stem: 'Find the derivative of the function by the limit process. (a) $f(x) = 3x + 2$ (b) $f(x) = \\frac{1}{x+1}$', answer: { values: ['(a) 3; (b) $-\\frac{1}{(x+1)^2}$'], source: 'handwritten' } }),
      'g1',
    )!
    expect(result.group).toMatchObject({ id: 'g1', stem: 'Find the derivative of the function by the limit process.', pageNumber: 2 })
    expect(result.parts.map((p) => [p.number, p.stem, p.answer.values, p.points, p.groupId])).toEqual([
      ['11(a)', '$f(x) = 3x + 2$', ['3'], 5, 'g1'],
      ['11(b)', '$f(x) = \\frac{1}{x+1}$', ['$-\\frac{1}{(x+1)^2}$'], 5, 'g1'],
    ])
  })

  it('handles numbered parts, keeps an answer it cannot share on the first part, and skips plain questions', () => {
    const result = splitParts(q({ stem: '求下列極限：（1）$\\lim_{x\\to 0} x$ （2）$\\lim_{x \\to 1} x^2$', answer: { values: ['0 與 1'], source: 'printed' } }), 'g2')!
    expect(result.parts.map((p) => p.number)).toEqual(['11(1)', '11(2)'])
    expect(result.parts[0]!.answer.values).toEqual(['0 與 1'])
    expect(result.parts[0]!.issues).toHaveLength(1)
    expect(result.parts[1]!.answer.values).toEqual([])
    expect(splitParts(q({ stem: 'Evaluate $f(a)$ and $g(b)$.' }), 'g3')).toBeNull()
    expect(splitParts(q({ type: 'matching', stem: 'Match: (1) ___ (2) ___' }), 'g6')).toBeNull()
    expect(splitParts(q({ stem: 'Fill the blanks with the options below. (A) Definitive host (B) Intermediate host (C) Zygote' }), 'g5')).toBeNull()
    expect(splitParts(q({ stem: '(a) x (b) y', groupId: 'other' }), 'g4')).toBeNull()
  })

  it('reads part numbers', () => {
    expect(splitNumber('11(a)')).toEqual({ main: '11', part: 'a' })
    expect(splitNumber('3（2）')).toEqual({ main: '3', part: '2' })
    expect(splitNumber('7')).toEqual({ main: '7', part: null })
  })
})

describe('mergeParts', () => {
  it('joins split parts back into one question that splits the same way again', () => {
    const original = q({ stem: 'Find the derivative of the function by the limit process. (a) $f(x) = 3x + 2$ (b) $f(x) = \\frac{1}{x+1}$', answer: { values: ['(a) 3; (b) $-1$'], source: 'handwritten' } })
    const { group, parts } = splitParts(original, 'g1')!
    const merged = mergeParts(group, parts)!
    expect(merged).toMatchObject({ number: '11', groupId: null, points: 10, issues: [] })
    expect(merged.stem).toBe('Find the derivative of the function by the limit process.\n\n(a) $f(x) = 3x + 2$\n\n(b) $f(x) = \\frac{1}{x+1}$')
    expect(merged.answer.values).toEqual(['(a) 3; (b) $-1$'])
    expect(splitParts(merged, 'g2')!.parts.map((p) => [p.number, p.answer.values])).toEqual(parts.map((p) => [p.number, p.answer.values]))
  })

  it('drops the split warning, keeps the lowest confidence and refuses parts of different numbers', () => {
    const { group, parts } = splitParts(q({ stem: '(1) x (2) y', answer: { values: ['both'], source: 'printed' } }), 'g3')!
    const merged = mergeParts(group, [parts[0]!, { ...parts[1]!, confidence: 'low' }])!
    expect(merged).toMatchObject({ confidence: 'low', issues: [], answer: { values: ['(1) both'] } })
    expect(mergeParts(group, [parts[0]!, { ...parts[1]!, number: '12(b)' }])).toBeNull()
    expect(mergeParts(group, [{ ...parts[0]!, number: '11' }])).toBeNull()
  })
})
