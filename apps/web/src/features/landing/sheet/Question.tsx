import type { CSSProperties } from 'react'
import type { SampleQuestion, Table, Text } from '../samples/types'
import { BESIDE, SheetFigure } from './figures'
import { Blank, LETTERS, Pencil, Slot } from './parts'
import { Printed } from './Printed'

interface Props {
  q: SampleQuestion
  n: number
  say: (text: Text) => string
  /** The copy with the student's pencil on it (the other one is clean, with the answer highlighted). */
  pencil: boolean
}

/** One question as printed on the paper exam. */
export function Question({ q, n, say, pencil }: Props) {
  const num = <span className="num shrink-0 text-muted">{n}.</span>
  switch (q.kind) {
    case 'choice': {
      const options = q.options.map(say)
      return (
        <div className="flex gap-1">
          <Slot on={pencil} mark={LETTERS[q.answer]!} />
          {num}
          <div className="min-w-0 flex-1">
            <p>
              <Printed text={say(q.text)} />
            </p>
            {q.code && <pre className="mt-1.5 overflow-hidden rounded border border-line bg-paper px-2.5 py-1.5 font-mono text-[11px] leading-[1.45]">{q.code}</pre>}
            <ol className={`mt-1 grid gap-x-3 gap-y-0.5 text-[13px] ${columns(options, q.answer)}`}>
              {options.map((o, k) => (
                <li key={k} className="flex items-baseline gap-1">
                  <span className="num text-muted">({LETTERS[k]})</span>
                  {/* the recognised answer gets the highlighter; the pencil copy keeps the same padding */}
                  <span className={k === q.answer ? (pencil ? 'hl' : 'hl m-sweep') : ''} style={k === q.answer ? (pencil ? NO_MARK : SWEEP) : undefined}>
                    <Printed text={o} />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )
    }
    case 'blank':
      return (
        <p className="flex gap-1">
          {num}
          <span>
            <Printed text={say(q.text)} blank={<Blank on={pencil}>{say(q.pencil)}</Blank>} />
          </span>
        </p>
      )
    case 'judge':
      return (
        <div className="flex gap-1">
          <Slot on={pencil} mark={q.answer ? '○' : '✕'} />
          {num}
          <div className="min-w-0 flex-1">
            <p>
              <Printed text={say(q.text)} />
            </p>
            {q.table && <SheetTable table={q.table} say={say} />}
          </div>
        </div>
      )
    case 'match':
      return (
        <div className="flex gap-1">
          {num}
          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-4 text-[13px]">
            <ol className="space-y-0.5">
              {q.items.map((item, k) => (
                <li key={k} className="flex items-baseline gap-1">
                  <Slot on={pencil} mark={LETTERS[q.answers[k]!]!} />
                  <span className="num text-muted">({k + 1})</span> <Printed text={say(item)} />
                </li>
              ))}
            </ol>
            <ol className="space-y-0.5 border-l border-line pl-3 text-muted">
              {q.options.map((o, k) => (
                <li key={k}>
                  <span className="num">({LETTERS[k]})</span> <Printed text={say(o)} />
                </li>
              ))}
            </ol>
          </div>
        </div>
      )
    case 'work':
      return (
        <div className="flex gap-1">
          {num}
          <div className="min-w-0 flex-1">
            <p>
              <Printed text={say(q.text)} />
            </p>
            <div className="mt-1.5 space-y-1 pl-1">
              {q.pencil.map((line, k) => (
                <p key={k}>
                  <Pencil on={pencil}>{say(line)}</Pencil>
                </p>
              ))}
            </div>
          </div>
        </div>
      )
    case 'draw':
      return (
        <div className="flex gap-1">
          {num}
          {/* a small figure stands to the right of the text, below it on phones */}
          <div className={`min-w-0 flex-1 ${BESIDE.has(q.figure) ? 'sm:flex sm:items-start sm:gap-3' : ''}`}>
            <p className="min-w-0 flex-1">
              <Printed text={say(q.text)} />
            </p>
            <SheetFigure name={q.figure} on={pencil} />
          </div>
        </div>
      )
    case 'write':
      return (
        <div className="flex gap-1">
          {num}
          {/* 田字格: a row per character, the printed one to trace first, then the student's tries */}
          <div className="space-y-1">
            {q.chars.map((c) => (
              <div key={c} className="flex gap-1">
                {[0, 1, 2, 3, 4, 5].map((k) => (
                  <span key={k} className="relative grid size-9 place-items-center border border-ink/30 text-[22px] leading-none">
                    <span className="absolute inset-0 bg-[linear-gradient(var(--color-ink)_0_0),linear-gradient(var(--color-ink)_0_0)] bg-[length:100%_1px,1px_100%] bg-center bg-no-repeat opacity-[0.12]" />
                    {k === 0 ? <span className="relative text-ink/35">{c}</span> : k < 4 && <Pencil on={pencil} className="relative text-[22px]">{c}</Pencil>}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )
  }
}

const SWEEP: CSSProperties = { animationDelay: 'var(--m-mark-at, 3s)' }
const NO_MARK: CSSProperties = { backgroundImage: 'none' }

/** Rough printed width in em: Chinese and kana a full em, Latin about half, formulas a little more. */
function width(text: string): number {
  let w = 0
  for (const part of text.split(/(\$[^$]+\$)/)) {
    const math = part.length > 2 && part.startsWith('$') && part.endsWith('$')
    const chars = math ? part.slice(1, -1).replace(/\\[a-zA-Z]+|[{}^_]/g, '') : part
    for (const ch of chars) {
      if (!math) w += ch.charCodeAt(0) > 0x2e80 ? 1 : 0.52
      else w += /[A-Z]/.test(ch) ? 0.8 : /[=+<>]/.test(ch) ? 1.4 : ch === '-' ? 1 : ch === ' ' ? 0.15 : 0.6
    }
  }
  return w
}

/** Options sit four to a row when they are short, else two, else one; phones fit less. */
function columns(options: string[], answer: number): string {
  // the highlighter adds a little padding around the answer
  const longest = Math.max(...options.map((o, k) => width(o) + (k === answer ? 0.35 : 0)))
  return longest <= 4.1 ? 'grid-cols-2 sm:grid-cols-4' : longest <= 7.3 ? 'grid-cols-2' : longest <= 11 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
}

function SheetTable({ table, say }: { table: Table; say: (text: Text) => string }) {
  return (
    <table className="mt-1.5 w-full max-w-[300px] border-collapse text-center text-[12px]">
      <thead>
        <tr>
          {table.head.map((h, i) => (
            <th key={i} className="border border-line px-2 py-0.5 font-medium">
              {say(h)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, k) => (
              <td key={k} className="border border-line px-2 py-0.5">
                {say(cell)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
