import { describe, expect, it } from 'vitest'
import { withWordBanks, type DraftExam, type DraftQuestion } from '../src/index.ts'

const box = 'memorial diligent industrial economical imaginary'.split(' ').map((content, i) => ({ label: 'ABCDE'[i]!, content }))

function q(number: string, stem: string, answer: string, overrides: Partial<DraftQuestion> = {}): DraftQuestion {
  return {
    number, section: 'B. Fill in the blanks', groupId: null, type: 'single_choice', stem, translation: null,
    options: box.map((o) => ({ ...o })), answer: { values: [answer], source: 'handwritten' }, explanation: null,
    points: 1, figures: [], confidence: 'high', issues: [], locations: [{ pageNumber: 2, bbox: { x: 0, y: 0, width: 1, height: 0.1 } }], ...overrides,
  }
}
const draft = (questions: DraftQuestion[], groups: DraftExam['groups'] = []): DraftExam => ({ fileName: 'x', meta: { title: null, subject: null, institution: null, term: null, language: null }, groups, questions, pages: [] })

describe('withWordBanks', () => {
  it('turns single-choice sentences repeating one word box into one word box', () => {
    const out = withWordBanks(draft([q('1', 'I like the ___ lines.', 'G'), q('2', 'It is not an ___ method.', 'D'), q('3', 'A 256K ___.', 'H')]))
    expect(out.groups).toEqual([{ id: 'wordbox-2-1', stem: '', figures: [], options: box, pageNumber: 2 }])
    expect(out.questions.every((x) => x.groupId === 'wordbox-2-1' && x.type === 'fill_in_blank')).toBe(true)
    expect(out.questions[1]!.answer.values).toEqual(['D'])
  })

  it('leaves ordinary choice questions and short runs alone', () => {
    const plain = draft([q('1', 'Which is a noun?', 'A'), q('2', 'Which is a verb?', 'B'), q('3', 'Which?', 'C')])
    expect(withWordBanks(plain)).toBe(plain)
    const two = draft([q('1', 'a ___', 'A'), q('2', 'b ___', 'B')])
    expect(withWordBanks(two)).toBe(two)
  })

  it('hands a group word box to its questions', () => {
    const groups = [{ id: 'g', stem: '', figures: [], options: box, pageNumber: 1 }]
    const out = withWordBanks(draft([q('1', 'a ___', '', { groupId: 'g', options: [], type: 'fill_in_blank' })], groups))
    expect(out.questions[0]!.options).toEqual(box)
    expect(withWordBanks(out)).toBe(out)
  })
})

describe('asWordBankQuestion', () => {
  it('evens out short and escaped blanks', async () => {
    const { asWordBankQuestion } = await import('../src/index.ts')
    expect(asWordBankQuestion(q('1', 'a __ b \\_\\_\\_ c ____', 'A'), box).stem).toBe('a ___ b ___ c ____')
  })
})
