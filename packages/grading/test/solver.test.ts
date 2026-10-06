import { needsAnswer, type DraftQuestion } from '@exam/core'
import { describe, expect, it } from 'vitest'
import { AiSolver, type TextModel } from '../src/index.ts'

const base: DraftQuestion = {
  number: '1', section: null, groupId: null, type: 'single_choice', stem: 'Which is a prime?', translation: null,
  options: [{ label: 'A', content: '4' }, { label: 'B', content: '7' }, { label: 'C', content: '9' }],
  answer: { values: [], source: 'none' }, explanation: null, points: 2, figures: [], confidence: 'high', issues: [], locations: [],
}

function fake(...replies: string[]) {
  const calls: { system: string; prompt: string }[] = []
  const model: TextModel = { provider: 'fake', model: 'fake-1', complete: async (system, prompt) => (calls.push({ system, prompt }), replies.shift() ?? '') }
  return { solver: new AiSolver(model), calls }
}

describe('needsAnswer', () => {
  it('asks only for questions with no key and an answer to give', () => {
    expect(needsAnswer(base)).toBe(true)
    expect(needsAnswer({ ...base, answer: { values: ['B'], source: 'printed' } })).toBe(false)
    expect(needsAnswer({ ...base, answer: { values: [' '], source: 'none' } })).toBe(true)
    expect(needsAnswer({ ...base, type: 'composition' })).toBe(false)
  })
})

describe('AiSolver', () => {
  it('maps choice labels back to the paper and writes the explanation in the chosen language', async () => {
    const { solver, calls } = fake('Here: {"values": ["(b)"], "explanation": "7 只有 1 和 7 兩個因數。"}')
    const solved = await solver.solve({ question: base, images: [], language: 'zh-Hant' })
    expect(solved).toEqual({ values: ['B'], explanation: '7 只有 1 和 7 兩個因數。' })
    expect(calls[0]!.system).toContain('Traditional Chinese')
    expect(calls[0]!.prompt).toContain('(B) 7')
  })

  it('reads true/false and retries once after a reply it cannot use', async () => {
    const { solver, calls } = fake('not json', '{"values": ["O"], "explanation": ""}')
    const solved = await solver.solve({ question: { ...base, type: 'true_false', options: [] }, images: [], language: 'en' })
    expect(solved.values).toEqual(['true'])
    expect(calls).toHaveLength(2)
  })
})
