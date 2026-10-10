import type { QuestionType } from '@exam/core'

/**
 * Text printed on a sample sheet. A plain string is a key marked with msg() and translated where
 * it is shown; `{ key, values }` fills `{name}` after translating (formulas go in values, so
 * translators never touch them); `{ raw }` is printed as is (an English or Japanese exam, code).
 * Printed text may hold `$…$` math, `<blank></blank>` for the space a student writes in, and
 * `<u>…</u>` for underlined words.
 */
export type Text = string | { key: string; values: Record<string, string> } | { raw: string }

export const raw = (text: string): Text => ({ raw: text })

export interface Table {
  head: Text[]
  rows: Text[][]
}

/** Figures drawn in SVG, each with the pencil marks a student left on it. */
export type Figure = 'number-line' | 'incline' | 'market'

interface Base {
  /** What the editor recognises it as (shown on its box). */
  type: QuestionType
  /** A section heading printed above the question, e.g. 一、選擇題. */
  section?: Text
}

/** One question of a sample sheet, with the student's pencil answer that the scan wipes off. */
export type SampleQuestion = Base &
  (
    | { kind: 'choice'; text: Text; code?: string; options: Text[]; answer: number; /** shown when it is practised (product tour) */ why: Text }
    | { kind: 'blank'; text: Text; pencil: Text }
    | { kind: 'judge'; text: Text; table?: Table; answer: boolean }
    | { kind: 'match'; items: Text[]; options: Text[]; answers: number[] }
    | { kind: 'work'; text: Text; pencil: Text[] }
    | { kind: 'draw'; text: Text; figure: Figure }
    | { kind: 'write'; chars: string[] }
  )

export interface Sample {
  id: string
  /** e.g. 國中數學 (msg key) */
  subject: string
  /** e.g. 第一次段考 (msg key) */
  exam: string
  questions: SampleQuestion[]
}
