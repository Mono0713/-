import type { DraftQuestion } from '@exam/core'
import type { InkDoc } from '@exam/ink'
import { buildItems } from '@exam/quiz'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { inkToPng, readHandwriting, readHandwrittenAnswers, repairLatex, unreadHandwriting, type TextModel } from '../src/index.ts'

function q(overrides: Partial<DraftQuestion>): DraftQuestion {
  return {
    number: '1', section: null, groupId: null, type: 'fill_in_blank', stem: 'Solve.', translation: null, options: [],
    answer: { values: ['1/2', '3'], source: 'printed' }, explanation: null, points: 2, figures: [], confidence: 'high', issues: [], locations: [],
    ...overrides,
  }
}
const settings = { mode: 'exam', shuffleQuestions: false, shuffleOptions: false, timeLimitMinutes: null } as const
const items = (questions: DraftQuestion[]) => buildItems(questions.map((question, i) => ({ questionId: String(i), question, group: null })), settings)

// A short line in the middle of a tall page.
const ink: InkDoc = { strokes: [{ points: [[0.4, 0.5, 0.5], [0.5, 0.5, 0.5], [0.6, 0.52, 0.5]], color: '#1b1d33', size: 0.006 }], height: 1 }

function fakeModel(replies: (string | Error)[]) {
  const calls: { prompt: string; images: number }[] = []
  const model: TextModel = {
    provider: 'fake',
    model: 'fake-1',
    async complete(_system, prompt, images) {
      calls.push({ prompt, images: images?.length ?? 0 })
      const reply = replies[Math.min(calls.length - 1, replies.length - 1)]!
      if (reply instanceof Error) throw reply
      return reply
    },
  }
  return { model, calls }
}

describe('handwriting', () => {
  it('sends the ink as a PNG cropped to the writing', async () => {
    const png = await inkToPng(ink, 1000)
    const meta = await sharp(png).metadata()
    expect(meta.format).toBe('png')
    expect(meta.height).toBeLessThan(200)
    expect(meta.width).toBeLessThan(400)
  })

  it('reads one string per blank and retries a bad reply once', async () => {
    const { model, calls } = fakeModel(['not json', 'Sure: {"values": ["$\\\\frac{1}{2}$", " 3 "]}'])
    const [item] = items([q({})])
    expect(await readHandwriting(model, item!, ink)).toEqual(['$\\frac{1}{2}$', '3'])
    expect(calls).toHaveLength(2)
    expect(calls[0]!.images).toBe(1)
  })

  it('repairs LaTeX the model forgot to escape in JSON', async () => {
    const [item] = items([q({ type: 'short_answer', answer: { values: ['x'], source: 'printed' } })])
    const { model } = fakeModel(['{"values": ["$\\frac{1}{2}$ and $\\theta \\neq 0$\\nnext line"]}'.replaceAll('\\\\', '\\')])
    expect(await readHandwriting(model, item!, ink)).toEqual(['$\\frac{1}{2}$ and $\\theta \\neq 0$\nnext line'])
    expect(repairLatex('two\nlines')).toBe('two\nlines')
  })

  it('reads only answers written by hand and not typed, and keeps going when one fails', async () => {
    const { model, calls } = fakeModel(['{"values": ["photosynthesis"]}', new Error('overloaded')])
    const open = q({ type: 'short_answer', answer: { values: ['photosynthesis'], source: 'printed' } })
    const attempt = {
      items: items([open, open, open]),
      responses: [{ values: [], handwriting: ink }, { values: ['typed'], handwriting: ink }, null],
    }
    expect(attempt.responses.map(unreadHandwriting)).toEqual([true, false, false])
    const read = await readHandwrittenAnswers(attempt, model)
    expect(calls).toHaveLength(1)
    expect(read[0]).toMatchObject({ values: ['photosynthesis'], transcribed: true })
    expect(read[1]).toBe(attempt.responses[1])

    const failing = fakeModel([new Error('overloaded')])
    await expect(readHandwrittenAnswers(attempt, failing.model)).rejects.toThrow('overloaded')
  })
})
