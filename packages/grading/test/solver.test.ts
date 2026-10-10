import { needsAnswer, needsExplanation, type DraftQuestion } from '@exam/core'
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

  it('offers an explanation only for a question with a key and none written', () => {
    const keyed = { ...base, answer: { values: ['B'], source: 'printed' as const } }
    expect(needsExplanation(base)).toBe(false)
    expect(needsExplanation(keyed)).toBe(true)
    expect(needsExplanation({ ...keyed, explanation: '7 是質數。' })).toBe(false)
  })
})

describe('AiSolver', () => {
  it('maps choice labels back to the paper', async () => {
    const { solver, calls } = fake('Here: {"values": ["(b)"]}')
    expect(await solver.solve({ question: base, images: [], language: 'zh-Hant' })).toEqual(['B'])
    expect(calls[0]!.prompt).toContain('(B) 7')
  })

  it('explains the given key in the chosen language', async () => {
    const { solver, calls } = fake('{"explanation": "7 只有 1 和 7 兩個因數。"}')
    const question = { ...base, answer: { values: ['B'], source: 'printed' as const } }
    expect(await solver.explain({ question, images: [], language: 'zh-Hant' })).toBe('7 只有 1 和 7 兩個因數。')
    expect(calls[0]!.system).toContain('Traditional Chinese')
    expect(calls[0]!.prompt).toMatch(/Answer key:\nB$/)
  })

  it('reads true/false and retries once after a reply it cannot use', async () => {
    const { solver, calls } = fake('not json', '{"values": ["O"]}')
    expect(await solver.solve({ question: { ...base, type: 'true_false', options: [] }, images: [], language: 'en' })).toEqual(['true'])
    expect(calls).toHaveLength(2)
  })
})
