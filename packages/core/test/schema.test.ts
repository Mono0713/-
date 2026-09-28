import { describe, expect, it } from 'vitest'
import { ExtractedPage, toStrictJsonSchema } from '../src/index.ts'
import { page, question } from './fixtures.ts'

type Node = { [key: string]: unknown }

function objects(node: unknown, found: Node[] = []): Node[] {
  if (Array.isArray(node)) node.forEach((n) => objects(n, found))
  else if (node && typeof node === 'object') {
    const obj = node as Node
    if (obj.type === 'object') found.push(obj)
    Object.values(obj).forEach((v) => objects(v, found))
  }
  return found
}

describe('toStrictJsonSchema', () => {
  const schema = toStrictJsonSchema(ExtractedPage)

  it('closes every object and requires all of its keys', () => {
    const all = objects(schema)
    expect(all.length).toBeGreaterThan(5)
    for (const obj of all) {
      expect(obj.additionalProperties).toBe(false)
      expect(obj.required).toEqual(Object.keys(obj.properties as Node))
    }
  })

  it('drops the $schema keyword', () => {
    expect(schema).not.toHaveProperty('$schema')
  })
})

describe('ExtractedPage', () => {
  it('accepts a well-formed page', () => {
    expect(ExtractedPage.safeParse(page([question()])).success).toBe(true)
  })

  it('rejects unknown question types', () => {
    const bad = page([{ ...question(), type: 'poem' as never }])
    expect(ExtractedPage.safeParse(bad).success).toBe(false)
  })
})
