import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { AiExamWriter, type ExamPlan, type TextModel, type WriteRequest } from '../src/index.ts'

const plan: ExamPlan = { types: [{ type: 'single_choice', count: 1 }, { type: 'true_false', count: 1 }], difficulty: 'medium', groups: true, figures: true, notes: 'only chapter 3', title: null }

function fake(...replies: string[]) {
  const calls: { system: string; prompt: string; images: number }[] = []
  const model: TextModel = { provider: 'fake', model: 'fake-1', complete: async (system, prompt, images = []) => (calls.push({ system, prompt, images: images.length }), replies.shift() ?? '') }
  return { writer: new AiExamWriter(model), calls }
}

const reply = {
  title: 'Cells',
  subject: 'Biology',
  language: 'en',
  groups: [{ id: 'g1', stem: 'Look at the diagram.', figure: { page: 1, bbox: { x: 0.1, y: 0.2, width: 0.5, height: 0.9 }, description: 'a cell' } }, { id: 'g2', stem: 'Unused' }],
  questions: [
    { type: 'single_choice', groupId: 'g1', stem: 'What is X?', options: [{ label: '(A)', content: 'Nucleus' }, { label: 'B', content: 'Wall' }], answer: ['(A)'], explanation: 'X is the nucleus.' },
    { type: 'true_false', stem: 'Cells divide.', answer: ['O'], figure: { page: 9, bbox: { x: 0, y: 0, width: 1, height: 1 } } },
    { type: 'poem', stem: 'Unknown type' },
  ],
}

async function request(): Promise<WriteRequest> {
  const image = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).webp().toBuffer()
  return { pages: [{ pageNumber: 1, text: null, image }, { pageNumber: 2, text: 'Mitosis has four phases.', image: null }], text: 'pasted notes', plan, language: 'zh-Hant' }
}

describe('AiExamWriter', () => {
  it('asks for the planned questions from the material and turns the reply into a draft', async () => {
    const { writer, calls } = fake('Here it is: ' + JSON.stringify(reply))
    const draft = await writer.write(await request())
    expect(calls[0]!.images).toBe(1)
    expect(calls[0]!.prompt).toContain('- single_choice: 1')
    expect(calls[0]!.prompt).toContain('only chapter 3')
    expect(calls[0]!.prompt).toContain('Mitosis has four phases.')
    expect(calls[0]!.prompt).toContain('pasted notes')
    expect(draft.meta).toMatchObject({ title: 'Cells', subject: 'Biology', language: 'en' })
    expect(draft.questions).toHaveLength(2)
    const [choice, tf] = draft.questions
    expect(choice).toMatchObject({ groupId: 'g1', options: [{ label: 'A' }, { label: 'B' }], answer: { values: ['A'], source: 'ai' }, explanation: 'X is the nucleus.' })
    expect(tf).toMatchObject({ groupId: null, answer: { values: ['true'] }, figures: [] })
    // the group nobody used is dropped; the figure box is kept inside the page
    expect(draft.groups.map((g) => g.id)).toEqual(['g1'])
    expect(draft.groups[0]!.figures[0]).toMatchObject({ pageNumber: 1, image: null, bbox: { y: 0.2, height: 0.8 } })
  })

  it('tries once more when the first reply is not JSON', async () => {
    const { writer, calls } = fake('sorry', JSON.stringify(reply))
    expect((await writer.write(await request())).questions).toHaveLength(2)
    expect(calls).toHaveLength(2)
  })

  it('leaves out groups and figures when they were not asked for', async () => {
    const { writer } = fake(JSON.stringify(reply))
    const draft = await writer.write({ ...(await request()), plan: { ...plan, groups: false, figures: false } })
    expect(draft.groups).toEqual([])
    expect(draft.questions.every((q) => !q.groupId && !q.figures.length)).toBe(true)
  })
})
