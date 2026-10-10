import { describe, expect, it } from 'vitest'
import { wordCount } from '../src/shared/wordCount'

describe('wordCount', () => {
  it('counts each CJK character and each word in other scripts', () => {
    expect(wordCount('我的志願')).toBe(4)
    expect(wordCount("It's a well-known fact.")).toBe(4)
    expect(wordCount('我喜歡 Python 3 和 C++')).toBe(7)
    expect(wordCount('  ')).toBe(0)
  })
})
