import type { DraftQuestion } from '@exam/core'
import { buildItems } from '@exam/quiz'
import { afterAll, describe, expect, it } from 'vitest'
import { testDatabase } from '@exam/db'
import { AiTeacher, markOpenAnswers, PostgresGradingCache, SqliteGradingCache, type TextModel } from '../src/index.ts'

function q(overrides: Partial<DraftQuestion>): DraftQuestion {
  return {
    number: '1', section: null, groupId: null, type: 'short_answer', stem: 'Why is the sky blue?', translation: null, options: [],
    answer: { values: ['Rayleigh scattering'], source: 'printed' }, explanation: null, points: 2, figures: [], confidence: 'high', issues: [], locations: [],
    ...overrides,
  }
}

/** A model that records prompts and gives every item the same credit. */
function fakeModel(reply: (prompt: string) => string) {
  const prompts: string[] = []
  const model: TextModel = {
    provider: 'fake',
    model: 'fake-1',
    async complete(_system, prompt) {
      prompts.push(prompt)
      return reply(prompt)
    },
  }
  return { model, prompts }
}
const allItems = (prompt: string) => [...prompt.matchAll(/### Item (\d+)/g)].map((m) => Number(m[1]))
const settings = { mode: 'exam', shuffleQuestions: false, shuffleOptions: false, timeLimitMinutes: null } as const

function attempt(questions: DraftQuestion[], answers: string[][]) {
  const items = buildItems(questions.map((question, i) => ({ questionId: String(i), question, group: null })), settings)
  return { items, responses: answers.map((values) => ({ values })), markings: items.map(() => null) }
}

// The first test runs on the Postgres cache when TEST_DATABASE_URL is set.
const pg = await testDatabase()
afterAll(() => pg?.drop())

describe('markOpenAnswers', () => {
  it('asks only about unsettled answers, in one request, and remembers the marks', async () => {
    const { model, prompts } = fakeModel((p) => JSON.stringify({ results: allItems(p).map((item) => ({ item, credit: 1, feedback: '' })) }))
    const cache = pg ? new PostgresGradingCache(pg.sql) : new SqliteGradingCache(':memory:')
    const grader = new AiTeacher(model)
    const a = attempt(
      [q({}), q({ type: 'fill_in_blank', answer: { values: ['\\frac{1}{2}'], source: 'printed' } }), q({ type: 'fill_in_blank', answer: { values: ['3'], source: 'printed' } }), q({ answer: { values: [], source: 'none' } })],
      [['light scatters off air molecules'], ['0.5'], ['three'], ['because of the atmosphere']],
    )
    const first = await markOpenAnswers(a, { grader, cache, language: 'zh-Hant' })
    expect(prompts).toHaveLength(1)
    expect(first).toMatchObject({ asked: 3, cached: 0 })
    expect(first.markings.map((m) => m?.credit ?? null)).toEqual([1, null, 1, 1])
    expect(prompts[0]).toContain('Reference answer: none given.')

    const again = await markOpenAnswers(a, { grader, cache, language: 'zh-Hant' })
    expect(prompts).toHaveLength(1)
    expect(again).toMatchObject({ asked: 0, cached: 3 })
  })

  it('leaves answers the model cannot judge for the person, and retries a reply that is not JSON', async () => {
    let calls = 0
    const { model } = fakeModel(() => (++calls === 1 ? 'Sorry, here you go:' : '{"results":[{"item":1,"credit":null,"feedback":""},{"item":2,"credit":0.5,"feedback":"少了一點"}]}'))
    const a = attempt([q({}), q({ type: 'essay' })], [['a'], ['b']])
    const result = await markOpenAnswers(a, { grader: new AiTeacher(model), cache: new SqliteGradingCache(':memory:'), language: 'zh-Hant' })
    expect(calls).toBe(2)
    expect(result.markings).toEqual([null, { credit: 0.5, by: 'ai', feedback: '少了一點' }])
  })

  it('splits many answers into a few requests', async () => {
    const { model, prompts } = fakeModel((p) => JSON.stringify({ results: allItems(p).map((item) => ({ item, credit: 0, feedback: 'x' })) }))
    const a = attempt(Array.from({ length: 23 }, () => q({ type: 'essay' })), Array.from({ length: 23 }, (_, i) => [`answer ${i}`]))
    const result = await markOpenAnswers(a, { grader: new AiTeacher(model), cache: new SqliteGradingCache(':memory:'), language: 'en' })
    expect(prompts).toHaveLength(3)
    expect(result.markings.every((m) => m?.credit === 0)).toBe(true)
  })
})
