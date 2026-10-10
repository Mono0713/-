import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import katex from 'katex'
import 'katex/contrib/mhchem'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)

// \ce comes from mhchem, which registers itself on the KaTeX the app imports. rehype-katex (the
// Markdown renderer) must use that same copy, or every \ce shows as a red error (pnpm-workspace.yaml overrides).
describe('chemical formulas', () => {
  it('rehype-katex shares the app KaTeX', () => {
    const fromRehype = createRequire(require.resolve('rehype-katex')).resolve('katex')
    expect(dirname(fromRehype)).toBe(dirname(require.resolve('katex')))
  })
  it('renders \\ce', () => {
    expect(katex.renderToString('\\ce{2H2 + O2 -> 2H2O}', { throwOnError: true })).toContain('katex')
  })
})
