import type { DraftExam, DraftQuestion } from '@exam/core'
import { describe, expect, it } from 'vitest'
import { withSections } from '../src/features/generate/sections'

const q = (type: DraftQuestion['type'], stem: string, groupId: string | null = null): DraftQuestion => ({
  number: '?', section: null, groupId, type, stem, translation: null, options: [], answer: { values: [], source: 'ai' }, explanation: null, points: null, figures: [], confidence: 'high', issues: [], locations: [],
})

const draft = (questions: DraftQuestion[]): DraftExam => ({
  fileName: 'x', meta: { title: null, subject: null, institution: null, term: null, language: null }, pages: [], questions,
  groups: [{ id: 'g', stem: 'passage', pageNumber: 0, figures: [] }],
})

const headings = { type: (t: string) => t, group: 'group' }

describe('withSections', () => {
  it('orders questions by the asked types, puts groups last and numbers them through', () => {
    const out = withSections(draft([q('true_false', 'b'), q('single_choice', 'g1', 'g'), q('single_choice', 'a'), q('true_false', 'c')]), headings, ['single_choice', 'true_false'], 'zh-Hant')
    expect(out.questions.map((x) => [x.number, x.stem, x.section])).toEqual([
      ['1', 'a', '一、single_choice'],
      ['2', 'b', '二、true_false'],
      ['3', 'c', '二、true_false'],
      ['4', 'g1', '三、group'],
    ])
  })

  it('numbers sections with roman numerals outside Chinese and Japanese', () => {
    expect(withSections(draft([q('essay', 'a')]), headings, ['essay'], 'en').questions[0]!.section).toBe('I. essay')
  })
})
