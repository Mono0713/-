import type { DraftQuestion } from '@exam/core'
import type { InkDoc } from '@exam/ink'
import { buildItems } from '@exam/quiz'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { drawingToPng, inkToPng, practiceToPng, readHandwriting, readHandwrittenAnswers, repairLatex, unreadHandwriting, type TextModel } from '../src/index.ts'

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

describe('writing practice', () => {
  it('sends the grid uncropped and returns one reading per row', async () => {
    const [item] = items([q({ type: 'writing', answer: { values: ['永', '天'], source: 'printed' } })])
    const { model, calls } = fakeModel(['{"values": ["永 永", "?天"]}'])
    expect(await readHandwriting(model, item!, { ...ink, height: 0.25 })).toEqual(['永永', '?天'])
    expect(calls[0]!.prompt).toContain('1. 永\n2. 天')
    const png = await practiceToPng(['永', '天'], { ...ink, height: 0.25 }, 800)
    expect((await sharp(png).metadata()).height).toBe(200)
  })
})

describe('drawing questions', () => {
  it('reads the strokes on top of the figure as one description', async () => {
    const [item] = items([q({ type: 'drawing', stem: 'Mark A = -1/3 on the number line.', answer: { values: ['A at -1/3'], source: 'printed' } })])
    const figure = await sharp({ create: { width: 400, height: 100, channels: 3, background: '#eeeeee' } }).png().toBuffer()
    const { model, calls } = fakeModel(['{"values": ["point A at about -0.3"]}'])
    expect(await readHandwriting(model, item!, { ...ink, height: 0.25 }, figure)).toEqual(['point A at about -0.3'])
    expect(calls[0]!.images).toBe(1)
    // the figure fills the page under the strokes, uncropped
    const png = await drawingToPng({ ...ink, height: 0.25 }, figure, 800)
    const meta = await sharp(png).metadata()
    expect([meta.width, meta.height]).toEqual([800, 200])
    const { data } = await sharp(png).extract({ left: 10, top: 10, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true })
    expect(data[0]).toBe(0xee)
  })
})
