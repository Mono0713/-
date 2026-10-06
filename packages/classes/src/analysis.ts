import { answerKind, summarize, type QuizAttempt, type QuizSource } from '@exam/quiz'
import type { StudentResult } from './stats.ts'

/** How the handed-in scores spread: ten bands of 10 %, and the usual summary numbers, all as shares 0–1. */
export interface Distribution {
  /** Students per band: 0–9 %, 10–19 % … 90–100 %. */
  bands: number[]
  count: number
  highest: number | null
  lowest: number | null
  median: number | null
}

export function distribution(students: StudentResult[]): Distribution {
  const shares = students
    .flatMap((r) => (r.counted?.handedIn && r.counted.max ? [r.counted.score / r.counted.max] : []))
    .sort((a, b) => a - b)
  const bands = Array.from({ length: 10 }, () => 0)
  for (const x of shares) bands[Math.min(9, Math.floor(x * 10))]!++
  const mid = shares.length / 2
  const median = shares.length === 0 ? null : shares.length % 2 ? shares[Math.floor(mid)]! : (shares[mid - 1]! + shares[mid]!) / 2
  return { bands, count: shares.length, highest: shares.at(-1) ?? null, lowest: shares[0] ?? null, median }
}

/** Which options students picked on one choice question. */
export interface OptionStat {
  questionId: string
  number: string
  stem: string
  /** Each option as stored, how many picked it, and whether the key has it. */
  options: { label: string; content: string; picked: number; correct: boolean }[]
  /** Handed-in attempts that left it blank. */
  blank: number
}

/** Option counts for every single- and multiple-choice question, over the handed-in attempts. Labels are the stored ones, so shuffling does not matter. */
export function optionStats(sources: QuizSource[], counted: QuizAttempt[]): OptionStat[] {
  const out: OptionStat[] = []
  for (const src of sources) {
    const kind = answerKind(src.question).kind
    if (kind !== 'single' && kind !== 'multiple') continue
    const picked = new Map<string, number>()
    let blank = 0
    for (const a of counted) {
      const i = a.items.findIndex((item) => item.questionId === src.questionId)
      if (i < 0) continue
      const values = a.responses[i]?.values.filter(Boolean) ?? []
      if (!values.length) blank++
      for (const v of new Set(values)) picked.set(v, (picked.get(v) ?? 0) + 1)
    }
    const key = new Set(src.question.answer.values)
    out.push({
      questionId: src.questionId,
      number: src.question.number,
      stem: src.question.stem,
      options: src.question.options.map((o) => ({ label: o.label, content: o.content, picked: picked.get(o.label) ?? 0, correct: key.has(o.label) })),
      blank,
    })
  }
  return out
}

/** Points earned and possible per question type, over some attempts: where a student loses points. */
export function typeRates(attempts: QuizAttempt[]): { type: string; score: number; max: number }[] {
  const by = new Map<string, { score: number; max: number }>()
  for (const a of attempts) {
    const s = summarize(a)
    a.items.forEach((item, i) => {
      const g = s.grades[i]!
      if (!g.max) return
      const e = by.get(item.question.type) ?? { score: 0, max: 0 }
      by.set(item.question.type, { score: e.score + g.score, max: e.max + g.max })
    })
  }
  return [...by].map(([type, e]) => ({ type, ...e })).sort((a, b) => a.score / a.max - b.score / b.max)
}
