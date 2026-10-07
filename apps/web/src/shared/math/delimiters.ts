/** A LaTeX command such as \frac, or a braced superscript or subscript. */
const LATEX = /\\[a-zA-Z]{2,}|[\^_]\{/
/** Runs of CJK characters and full-width punctuation, which never belong inside a formula. */
const CJK = /([⺀-鿿豈-﫿＀-￯　-〿]+)/

/** Pieces that can sit inside a formula next to LaTeX: numbers, single letters, operators. */
const MATHY = /^[\p{N}a-zA-Z]?[\p{N}+\-*/=<>()[\].,|!]*$/u

/**
 * Wraps bare LaTeX in $…$ so it shows as a formula, e.g. an answer the model wrote as
 * "\frac{4}{13}". Only the formula is wrapped, not the words around it.
 * Text that already has $ delimiters is left alone.
 */
export function withMathDelimiters(text: string): string {
  if (!text || text.includes('$') || !LATEX.test(text)) return text
  return text
    .split(CJK)
    .map((part, i) => (i % 2 === 1 || !LATEX.test(part) ? part : wrapFormulas(part)))
    .join('')
}

function wrapFormulas(part: string): string {
  // Words, keeping {…} groups whole even when they hold spaces.
  const words: string[] = []
  let depth = 0
  for (const piece of part.split(/(\s+)/)) {
    if (depth > 0) words[words.length - 1] += piece
    else words.push(piece)
    for (const ch of piece) depth = Math.max(0, depth + (ch === '{' ? 1 : ch === '}' ? -1 : 0))
  }
  const isSpace = (w: string) => /^\s*$/.test(w)
  const inFormula = words.map((w) => !isSpace(w) && LATEX.test(w))
  // Grow each formula over the numbers, letters and operators right next to it.
  for (let changed = true; changed; ) {
    changed = false
    words.forEach((w, k) => {
      if (inFormula[k] || isSpace(w) || !MATHY.test(w)) return
      const near = (step: number) => {
        let j = k + step
        while (words[j] !== undefined && isSpace(words[j]!)) j += step
        return inFormula[j] === true
      }
      if (near(-1) || near(1)) changed = inFormula[k] = true
    })
  }
  let out = ''
  let formula: string[] | null = null
  const flush = () => {
    if (!formula) return
    const body = formula.join('')
    // A sentence's full stop or comma stays outside the formula.
    const [, core, tail] = body.match(/^([\s\S]*?)([.,;:]?)$/)!
    out += `$${core}$${tail}`
    formula = null
  }
  // A space stays inside when the formula goes on after it.
  const continues = (k: number) => inFormula[words.findIndex((w, j) => j > k && !isSpace(w))] === true
  words.forEach((w, k) => {
    if (inFormula[k]) (formula ??= []).push(w)
    else if (formula && isSpace(w) && continues(k)) formula.push(w)
    else {
      flush()
      out += w
    }
  })
  flush()
  return out
}

export type Segment = { kind: 'text'; text: string } | { kind: 'math'; latex: string; display: boolean }

/** Splits text into plain runs and $…$ / $$…$$ formulas. */
export function splitMath(text: string): Segment[] {
  const out: Segment[] = []
  const re = /\$\$([\s\S]+?)\$\$|(?<!\\)\$([^$\n]+?)\$/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push({ kind: 'text', text: text.slice(last, m.index) })
    out.push(m[1] !== undefined ? { kind: 'math', latex: m[1].trim(), display: true } : { kind: 'math', latex: m[2]!.trim(), display: false })
    last = m.index! + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

/**
 * Pasted text as stored text: formulas written \( … \) or \[ … \] (as chat apps and documents
 * copy them) get $ delimiters, and bare LaTeX is wrapped like everywhere else.
 */
export function fromPaste(text: string): string {
  const marked = text.replace(/\\\[([\s\S]+?)\\\]/g, (_, f: string) => `$$${f.trim()}$$`).replace(/\\\(([\s\S]+?)\\\)/g, (_, f: string) => `$${f.trim()}$`)
  return withMathDelimiters(marked)
}
