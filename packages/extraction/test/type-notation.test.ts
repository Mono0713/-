import { describe, expect, it } from 'vitest'
import { ExtractedPage, toStrictJsonSchema } from '@exam/core'
import { typeNotation } from '../src/type-notation.ts'

describe('typeNotation', () => {
  it('declares shapes used more than once by name and keeps descriptions as comments', () => {
    const box = { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } }
    const text = typeNotation(
      {
        type: 'object',
        properties: {
          bbox: { ...box, description: 'Where it is' },
          kind: { type: 'string', enum: ['a', 'b'] },
          note: { type: ['string', 'null'] },
          count: { type: 'integer' },
          parts: { type: 'array', items: { type: 'object', properties: { bbox: box, tags: { type: 'array', items: { type: 'string' } } } } },
        },
      },
      'Root',
    )
    expect(text).toBe(
      [
        'type Box = { x: number; y: number }',
        '',
        'type Root = {',
        '  bbox: Box // Where it is',
        '  kind: "a" | "b"',
        '  note: string | null',
        '  count: integer',
        '  parts: Array<{ bbox: Box; tags: string[] }>',
        '}',
      ].join('\n'),
    )
  })

  it('is much shorter than the JSON Schema of a page', () => {
    const schema = toStrictJsonSchema(ExtractedPage)
    const text = typeNotation(schema, 'Page')
    expect(text.length).toBeLessThan(JSON.stringify(schema).length / 2)
    for (const key of ['continuesOnNextPage', 'printedText', 'confidence', 'notes']) expect(text).toContain(`${key}:`)
  })
})
