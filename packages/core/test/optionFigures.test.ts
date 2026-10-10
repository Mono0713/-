import { describe, expect, it } from 'vitest'
import { optionFigures, questionFigures } from '../src/figures.ts'
import { ExtractedPage } from '../src/schema.ts'
import { toStrictJsonSchema } from '../src/json-schema.ts'

const box = { x: 0, y: 0, width: 1, height: 1 }
const fig = (description: string, option?: string | null) => ({ description, bbox: box, blanks: [], option })

describe('picture options', () => {
  const q = { options: [{ label: 'A' }, { label: 'B' }], figures: [fig('stem'), fig('graph A', 'A'), fig('graph B', 'B'), fig('old', undefined), fig('gone', 'E')] }

  it('splits the question figures from the option pictures', () => {
    expect(questionFigures(q).map((f) => f.description)).toEqual(['stem', 'old', 'gone'])
    expect(optionFigures(q, 'A').map((f) => f.description)).toEqual(['graph A'])
    expect(optionFigures(q, 'C')).toEqual([])
  })

  it('reads figures without an option as figures of the question', () => {
    const page = ExtractedPage.parse({
      meta: { title: null, subject: null, institution: null, term: null, language: null },
      groups: [{ id: 'g', stem: '', figures: [{ description: 'd', bbox: box, blanks: [] }] }],
      questions: [],
      notes: null,
    })
    expect(page.groups[0]!.figures[0]!.option).toBeNull()
  })

  it('asks every model for the option of each figure', () => {
    const text = JSON.stringify(toStrictJsonSchema(ExtractedPage))
    expect(text).toContain('"option"')
  })
})
