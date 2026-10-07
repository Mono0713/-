import { describe, expect, it } from 'vitest'
import { optionColumns, paginate } from '../src/features/sheet/layout.ts'

describe('paginate', () => {
  it('fills a page, then starts the next', () => {
    expect(paginate([{ height: 40 }, { height: 40 }, { height: 40 }], 100, 10)).toEqual([[0, 1], [2]])
  })
  it('keeps a heading with the question after it', () => {
    expect(paginate([{ height: 60 }, { height: 10, keepWithNext: true }, { height: 30 }], 100, 5)).toEqual([[0], [1, 2]])
  })
  it('gives a block taller than a page a page of its own', () => {
    expect(paginate([{ height: 20 }, { height: 150 }, { height: 20 }], 100, 0)).toEqual([[0], [1], [2]])
  })
  it('places a run too tall for any page block by block', () => {
    expect(paginate([{ height: 60, keepWithNext: true }, { height: 60 }], 100, 0)).toEqual([[0], [1]])
  })
  it('has one empty page when there is nothing', () => {
    expect(paginate([], 100, 0)).toEqual([[]])
  })
})

describe('optionColumns', () => {
  it('puts short options four to a line', () => {
    expect(optionColumns([{ content: '3' }, { content: '4' }, { content: '$\\frac{1}{2}$' }, { content: '6' }], false)).toBe(4)
  })
  it('uses two columns for medium options and one for long ones', () => {
    expect(optionColumns([{ content: '細胞膜具有選擇性通透的特性' }], false)).toBe(2)
    expect(optionColumns([{ content: '光合作用的光反應發生在葉綠體的類囊體膜上，產生氧氣' }], false)).toBe(1)
  })
})
