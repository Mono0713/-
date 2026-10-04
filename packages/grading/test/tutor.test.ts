import type { DraftQuestion } from '@exam/core'
import { buildItems } from '@exam/quiz'
import { describe, expect, it } from 'vitest'
import { AiTutor, parseReply, type TextModel } from '../src/index.ts'

const question: DraftQuestion = {
  number: '1', section: null, groupId: null, type: 'calculation', stem: 'Solve $2x + 3 = 7$.', translation: null, options: [],
  answer: { values: ['x = 2'], source: 'printed' }, explanation: 'Subtract 3, then divide by 2.', points: 2, figures: [], confidence: 'high', issues: [], locations: [],
}
const [item] = buildItems([{ questionId: 'q1', question, group: null }], { mode: 'practice', shuffleQuestions: false, shuffleOptions: false, timeLimitMinutes: null })

function fake(reply: string) {
  const calls: { system: string; prompt: string }[] = []
  const model: TextModel = { provider: 'fake', model: 'fake-1', complete: async (system, prompt) => (calls.push({ system, prompt }), reply) }
  return { tutor: new AiTutor(model), calls }
}

describe('AiTutor', () => {
  it('explains against the key and the student answer, in the chosen language', async () => {
    const { tutor, calls } = fake('{"reply":"你的答案是錯的。先把 3 移過去…"}')
    const text = await tutor.reply({
      item: item!,
      response: { values: ['x = 5'] },
      marking: { credit: 0, by: 'ai', feedback: 'Wrong sign.' },
      turns: [{ from: 'student', text: '請講解這題', at: '' }],
      language: 'zh-Hant',
    })
    expect(text).toBe('你的答案是錯的。先把 3 移過去…')
    expect(calls[0]!.system).toContain('Traditional Chinese')
    expect(calls[0]!.prompt).toContain('Reference answer:\nx = 2')
    expect(calls[0]!.prompt).toContain('Explanation:\nSubtract 3')
    expect(calls[0]!.prompt).toContain("Student's answer:\nx = 5")
    expect(calls[0]!.prompt).toContain('Mark: 0% of the points. Comment: Wrong sign.')
    expect(calls[0]!.prompt).toMatch(/Student: 請講解這題\n\nReply to the student's last message\.$/)
  })

  it('sends the conversation so far with a follow-up question', async () => {
    const { tutor, calls } = fake('{"reply":"ok"}')
    await tutor.reply({
      item: item!,
      response: null,
      marking: null,
      turns: [
        { from: 'student', text: '請講解這題', at: '' },
        { from: 'tutor', text: '先減 3。', at: '' },
        { from: 'student', text: '為什麼要先減 3？', at: '' },
      ],
      language: 'en',
    })
    expect(calls[0]!.prompt).toContain("Student's answer:\n(no answer)")
    expect(calls[0]!.prompt).toContain('Tutor: 先減 3。\n\nStudent: 為什麼要先減 3？')
  })
})

describe('parseReply', () => {
  it('takes the JSON reply, or plain prose from a model that ignored the format', () => {
    expect(parseReply('```json\n{"reply":"Hi"}\n```')).toBe('Hi')
    expect(parseReply('Just text, with {braces} inside')).toBe('Just text, with {braces} inside')
    expect(() => parseReply('  ')).toThrow()
  })
})
