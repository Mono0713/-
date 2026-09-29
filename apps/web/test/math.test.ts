import { describe, expect, it } from 'vitest'
import { splitMath, withMathDelimiters } from '../src/shared/math/delimiters.ts'

describe('withMathDelimiters', () => {
  it('wraps a bare formula', () => {
    expect(withMathDelimiters('\\frac{4}{13}')).toBe('$\\frac{4}{13}$')
  })
  it('leaves text with $ formulas and plain text alone', () => {
    expect(withMathDelimiters('結果為 $\\frac{1}{2}$')).toBe('結果為 $\\frac{1}{2}$')
    expect(withMathDelimiters('x = 2')).toBe('x = 2')
  })
  it('wraps only the formula inside Chinese text', () => {
    expect(withMathDelimiters('結果分別為 \\frac{1}{2} 與 0')).toBe('結果分別為 $\\frac{1}{2}$ 與 0')
  })
  it('wraps only the formula inside English text, with the operators next to it', () => {
    expect(withMathDelimiters('The limit is x = \\frac{a + b}{2}, so it converges.')).toBe('The limit is $x = \\frac{a + b}{2}$, so it converges.')
    expect(withMathDelimiters('Dilute to 10^{-4} and plate it')).toBe('Dilute to $10^{-4}$ and plate it')
  })
})

describe('splitMath', () => {
  it('splits text and inline and display formulas', () => {
    expect(splitMath('a $x^2$ b $$\\int f$$')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'math', latex: 'x^2', display: false },
      { kind: 'text', text: ' b ' },
      { kind: 'math', latex: '\\int f', display: true },
    ])
  })
  it('ignores escaped dollar signs', () => {
    expect(splitMath('costs \\$5')).toEqual([{ kind: 'text', text: 'costs \\$5' }])
  })
})
