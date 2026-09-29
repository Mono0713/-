/**
 * Decides without any AI whether two written maths answers mean the same thing:
 * "1/2", "0.5", "½", "50%" and "\frac{1}{2}" are equal, and so are "2x+1" and "1 + 2*x".
 * Expressions are compared by evaluating both at a few fixed points.
 */

/** Whether `given` equals `expected` as a number or an expression. False when either is not maths. */
export function sameMath(expected: string, given: string): boolean {
  const e = parse(dropVariableName(toPlain(expected)))
  const g = parse(dropVariableName(toPlain(given)))
  if (!e || !g) return false
  const vars = [...new Set([...variables(e), ...variables(g)])]
  if (!vars.length) {
    const a = evaluate(e, {})
    const b = evaluate(g, {})
    return close(a, b) || roundedTo(given, a, b)
  }
  return POINTS.every((p) => {
    const scope = Object.fromEntries(vars.map((v, i) => [v, p + i * 0.37]))
    const a = evaluate(e, scope)
    const b = evaluate(g, scope)
    return (!Number.isFinite(a) && !Number.isFinite(b)) || close(a, b)
  })
}

/** The value of a plain number or constant expression ("1/2", "8e6", "\\sqrt{2}"); null for anything else. */
export function numberValue(text: string): number | null {
  const node = parse(dropVariableName(toPlain(text)))
  if (!node || variables(node).length) return null
  const v = evaluate(node, {})
  return Number.isFinite(v) ? v : null
}

const POINTS = [0.731, 1.618, 2.414, -1.257, 3.1]

function close(a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
}

/** "0.33" for 1/3: a decimal with two or more places that is the key rounded to those places. */
function roundedTo(given: string, key: number, value: number): boolean {
  const places = given.trim().match(/^-?\d*\.(\d{2,})$/)?.[1]?.length
  return places !== undefined && Number.isFinite(key) && Math.abs(key - value) <= 0.5 * 10 ** -places + 1e-12
}

/** "x = 2" and "2" are the same answer. */
function dropVariableName(s: string): string {
  return s.replace(/^\s*[a-zA-Z]\s*=\s*(?=\S)/, '')
}

const UNICODE_FRACTIONS: Record<string, string> = { '½': '(1/2)', '⅓': '(1/3)', '⅔': '(2/3)', '¼': '(1/4)', '¾': '(3/4)', '⅕': '(1/5)', '⅛': '(1/8)' }
const SUPERSCRIPTS: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' }

/** LaTeX and typed maths in one plain syntax: numbers, + - * / ^, parentheses, names. */
function toPlain(input: string): string {
  // Superscripts and vulgar fractions first: NFKC would turn "x²" into "x2".
  let s = input
    .replace(/[½⅓⅔¼¾⅕⅛]/g, (c) => UNICODE_FRACTIONS[c]!)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (run) => `^(${[...run].map((c) => SUPERSCRIPTS[c]).join('')})`)
    .normalize('NFKC')
    .replace(/⁄/g, '/')
    .trim()
  s = s.replace(/^\$+|\$+$/g, '')
  s = s.replace(/\\(left|right|displaystyle|,|;|!|quad|qquad)/g, ' ').replace(/\\ /g, ' ')
  s = s.replace(/\\text\{([^}]*)\}|\\mathrm\{([^}]*)\}/g, (_, a, b) => a ?? b)
  s = replaceCommand(s, /\\[dt]?frac/, 2, ([a, b]) => `((${a})/(${b}))`)
  s = s.replace(/\\sqrt\[([^\]]+)\]/g, '\\root{$1}')
  s = replaceCommand(s, /\\root/, 2, ([n, x]) => `((${x})^(1/(${n})))`)
  s = replaceCommand(s, /\\sqrt/, 1, ([x]) => `sqrt(${x})`)
  s = s.replace(/(\d)\s*[xX]\s*(?=\d)/g, '$1*') // 8x10^6
  s = s.replace(/\\(cdot|times)|[×·]/g, '*').replace(/\\div|÷/g, '/').replace(/[−–]/g, '-')
  s = s.replace(/\\pi|π/g, 'pi').replace(/\\infty|∞/g, 'inf')
  s = s.replace(/\\(sin|cos|tan|ln|log|exp)/g, '$1')
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)')
  // 1.5e-3 and 1.5E3 are numbers; a lone e is Euler's number.
  s = s.replace(/(\d)[eE]([+-]?\d)/g, '$1*10^$2')
  s = s.replace(/[{[]/g, '(').replace(/[}\]]/g, ')')
  return s
}

/** Replaces `\cmd{a}{b}` (with nested braces) using its `count` arguments. */
function replaceCommand(s: string, command: RegExp, count: number, make: (args: string[]) => string): string {
  for (let guard = 0; guard < 50; guard++) {
    const m = s.match(command)
    if (!m || m.index === undefined) return s
    let i = m.index + m[0].length
    const args: string[] = []
    while (args.length < count) {
      while (s[i] === ' ') i++
      if (s[i] !== '{') return s
      let depth = 0
      const start = i
      for (; i < s.length; i++) {
        if (s[i] === '{') depth++
        else if (s[i] === '}' && --depth === 0) break
      }
      if (depth !== 0) return s
      args.push(s.slice(start + 1, i))
      i++
    }
    s = s.slice(0, m.index) + make(args) + s.slice(i)
  }
  return s
}

type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; name: string }
  | { t: 'op'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { t: 'neg'; a: Node }
  | { t: 'fn'; name: string; a: Node }

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  abs: Math.abs,
}
const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E, inf: Infinity }

/** Parses plain maths; null when the text is not a formula (words, units, lists…). */
function parse(text: string): Node | null {
  const tokens = text.match(/\d+(?:\.\d+)?|\.\d+|[a-zA-Z]+|[+\-*/^()|]|\S/g)
  if (!tokens?.length) return null
  // Words longer than a function name are prose, not maths.
  if (tokens.some((t) => /^[a-zA-Z]{2,}$/.test(t) && !(t in FUNCTIONS) && !(t in CONSTANTS))) return null
  let i = 0
  const peek = () => tokens[i]
  const startsFactor = (t: string | undefined) => t !== undefined && (/^[\d.a-zA-Z(]/.test(t) || t === '|')

  const expr = (): Node => {
    let node = term()
    while (peek() === '+' || peek() === '-') {
      const op = tokens[i++] as '+' | '-'
      node = { t: 'op', op, a: node, b: term() }
    }
    return node
  }
  const term = (): Node => {
    let node = unary()
    for (;;) {
      if (peek() === '*' || peek() === '/') {
        const op = tokens[i++] as '*' | '/'
        node = { t: 'op', op, a: node, b: unary() }
      } else if (startsFactor(peek())) node = { t: 'op', op: '*', a: node, b: power() } // 2x, 3(x+1)
      else return node
    }
  }
  const unary = (): Node => {
    if (peek() === '-') return i++, { t: 'neg', a: unary() }
    if (peek() === '+') return i++, unary()
    return power()
  }
  const power = (): Node => {
    const base = atom()
    if (peek() !== '^') return base
    i++
    return { t: 'op', op: '^', a: base, b: unary() }
  }
  const atom = (): Node => {
    const t = tokens[i++]
    if (t === undefined) throw new Error('end')
    if (/^[\d.]/.test(t)) return { t: 'num', v: Number(t) }
    if (t === '(') {
      const inner = expr()
      if (tokens[i++] !== ')') throw new Error(')')
      return inner
    }
    if (t === '|') {
      const inner = expr()
      if (tokens[i++] !== '|') throw new Error('|')
      return { t: 'fn', name: 'abs', a: inner }
    }
    if (t in FUNCTIONS) return { t: 'fn', name: t, a: power() }
    if (t in CONSTANTS) return { t: 'num', v: CONSTANTS[t]! }
    if (/^[a-zA-Z]$/.test(t)) return { t: 'var', name: t }
    throw new Error(t)
  }

  try {
    const node = expr()
    return i === tokens.length ? node : null
  } catch {
    return null
  }
}

function variables(node: Node): string[] {
  switch (node.t) {
    case 'num':
      return []
    case 'var':
      return [node.name]
    case 'op':
      return [...variables(node.a), ...variables(node.b)]
    default:
      return variables(node.a)
  }
}

function evaluate(node: Node, scope: Record<string, number>): number {
  switch (node.t) {
    case 'num':
      return node.v
    case 'var':
      return scope[node.name] ?? NaN
    case 'neg':
      return -evaluate(node.a, scope)
    case 'fn':
      return FUNCTIONS[node.name]!(evaluate(node.a, scope))
    case 'op': {
      const a = evaluate(node.a, scope)
      const b = evaluate(node.b, scope)
      return node.op === '+' ? a + b : node.op === '-' ? a - b : node.op === '*' ? a * b : node.op === '/' ? a / b : a ** b
    }
  }
}
