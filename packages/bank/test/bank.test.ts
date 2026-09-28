import { describe, expect, it } from 'vitest'
import type { DraftExam, DraftQuestion } from '@exam/core'
import { SqliteBank } from '../src/index.ts'

function draftQuestion(overrides: Partial<DraftQuestion> = {}): DraftQuestion {
  return {
    number: '1', section: null, groupId: null, type: 'single_choice', stem: 'What is $1+1$?', translation: null,
    options: [{ label: 'A', content: '2' }, { label: 'B', content: '3' }], answer: { values: ['A'], source: 'printed' },
    explanation: null, points: 5, figures: [], confidence: 'high', issues: [], locations: [{ pageNumber: 1, bbox: { x: 0, y: 0, width: 1, height: 0.1 } }],
    ...overrides,
  }
}

const meta = { title: '期中考', subject: '數學', institution: null, term: null, language: 'zh-Hant' }

describe('SqliteBank', () => {
  it('tracks an import from upload to saved questions', () => {
    const bank = new SqliteBank(':memory:')
    const imp = bank.createImport({ ownerId: 'local', fileName: 'exam.pdf', pageCount: 2, provider: 'manual', model: null })
    expect(imp.status).toBe('processing')

    bank.updateImport(imp.id, { status: 'review', progress: { done: 2, total: 2 } })
    const draft: DraftExam = { fileName: 'exam.pdf', meta, groups: [], questions: [draftQuestion(), draftQuestion({ number: '2', type: 'essay', stem: 'Explain gravity.' })], pages: [] }
    bank.saveDraft(imp.id, draft)
    expect(bank.getDraft(imp.id)?.questions).toHaveLength(2)
    expect(bank.getImport(imp.id)).toMatchObject({ status: 'review', title: '期中考', subject: '數學', progress: { done: 2, total: 2 } })

    const saved = bank.saveQuestions(imp.id, meta, draft.questions)
    expect(saved.map((q) => q.number)).toEqual(['1', '2'])
    expect(saved[0]).toMatchObject({ subject: '數學', examTitle: '期中考', importId: imp.id })
    expect(bank.getImport(imp.id)).toMatchObject({ status: 'saved', questionCount: 2 })

    // Saving the same import again replaces its questions instead of duplicating them.
    bank.saveQuestions(imp.id, meta, draft.questions.slice(0, 1))
    expect(bank.listQuestions({ ownerId: 'local' }).total).toBe(1)
  })

  it('searches, filters and edits questions', () => {
    const bank = new SqliteBank(':memory:')
    const imp = bank.createImport({ ownerId: 'local', fileName: 'exam.pdf', pageCount: 1, provider: 'claude', model: null })
    bank.saveQuestions(imp.id, meta, [draftQuestion(), draftQuestion({ number: '2', type: 'essay', stem: 'Explain Gravity.' })])
    const other = bank.createImport({ ownerId: 'someone-else', fileName: 'x.pdf', pageCount: 1, provider: 'claude', model: null })
    bank.saveQuestions(other.id, meta, [draftQuestion({ stem: 'gravity again' })])

    expect(bank.listQuestions({ ownerId: 'local', search: 'gravity' }).items.map((q) => q.number)).toEqual(['2'])
    expect(bank.listQuestions({ ownerId: 'local', type: 'single_choice' }).total).toBe(1)
    expect(bank.subjects('local')).toEqual(['數學'])

    const q = bank.listQuestions({ ownerId: 'local', type: 'essay' }).items[0]!
    const updated = bank.updateQuestion(q.id, { ...q, stem: 'Explain magnetism.', subject: '物理' })
    expect(updated).toMatchObject({ stem: 'Explain magnetism.', subject: '物理', id: q.id })
    expect(bank.listQuestions({ ownerId: 'local', search: 'magnetism' }).total).toBe(1)

    bank.deleteQuestion(q.id)
    expect(bank.getQuestion(q.id)).toBeNull()
  })
})
