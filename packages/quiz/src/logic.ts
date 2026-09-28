import type { DraftFigure, DraftQuestion } from '@exam/core'
import type { Grade, QuizAttempt, QuizItem, QuizResponse, QuizSettings, Marking } from './types.ts'

/** How a question is answered in a quiz. */
export type AnswerKind =
  | { kind: 'single' }
  | { kind: 'multiple' }
  | { kind: 'true_false' }
  /** One input per blank; figure blanks come first, drawn on the figure. */
  | { kind: 'blanks'; count: number; figureBlanks: number }
  | { kind: 'text' }

export function answerKind(q: DraftQuestion): AnswerKind {
  const figureBlanks = q.figures.reduce((n, f) => n + (f.image?.blanks.length ?? f.blanks.length), 0)
  if (q.type === 'single_choice' && q.options.length) return { kind: 'single' }
  if (q.type === 'multiple_choice' && q.options.length) return { kind: 'multiple' }
  if (q.type === 'true_false') return { kind: 'true_false' }
  if (q.type === 'fill_in_blank' || q.type === 'matching') {
    return { kind: 'blanks', count: Math.max(1, figureBlanks, q.answer.values.length), figureBlanks }
  }
  return { kind: 'text' }
}

export interface QuizSource {
  questionId: string
  question: DraftQuestion
  group: { stem: string; figures: DraftFigure[] } | null
}

/** Lays out the chosen questions for one quiz, shuffling questions and choice options if asked. */
export function buildItems(sources: QuizSource[], settings: QuizSettings, random: () => number = Math.random): QuizItem[] {
  const ordered = settings.shuffleQuestions ? shuffle(sources, random) : sources
  return ordered.map(({ questionId, question, group }) => {
    const labels = question.options.map((o) => o.label)
    const kind = answerKind(question).kind
    const choice = kind === 'single' || kind === 'multiple'
    if (!choice || !settings.shuffleOptions) return { questionId, question, group, optionOrder: labels, displayLabels: labels }
    const optionOrder = shuffle(labels, random)
    return { questionId, question, group, optionOrder, displayLabels: relabel(labels) }
  })
}

/** Labels in the same style as the originals (A, a, 1, 甲…), in plain order. */
function relabel(labels: string[]): string[] {
  const first = labels[0] ?? 'A'
  const heavenly = '甲乙丙丁戊己庚辛壬癸'
  if (/^\d+$/.test(first)) return labels.map((_, i) => String(i + 1))
  if (/^[a-z]$/.test(first)) return labels.map((_, i) => String.fromCharCode(97 + i))
  if (heavenly.includes(first) && labels.length <= heavenly.length) return labels.map((_, i) => heavenly[i]!)
  return labels.map((_, i) => String.fromCharCode(65 + i))
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/** Marks one answer against the question's answer key. */
export function grade(q: DraftQuestion, response: QuizResponse | null, marking: Marking | null = null): Grade {
  const key = q.answer.values
  const worth = q.points ?? 1
  if (!key.length || key.every((v) => !v.trim())) return { status: 'no_key', score: 0, max: 0 }
  const given = response?.values ?? []
  const answered = given.some((v) => v.trim())
  const kind = answerKind(q)

  if (kind.kind === 'text') {
    if (!answered) return { status: 'unanswered', score: 0, max: worth }
    if (!marking) return { status: 'pending', score: 0, max: worth }
    const credit = Math.min(1, Math.max(0, marking.credit))
    return { status: credit >= 1 ? 'correct' : credit <= 0 ? 'wrong' : 'partial', score: Math.round(worth * credit * 100) / 100, max: worth }
  }
  if (!answered) return { status: 'unanswered', score: 0, max: worth }

  if (kind.kind === 'single' || kind.kind === 'multiple' || kind.kind === 'true_false') {
    const same = sameSet(key.map(normalize), given.map(normalize))
    return { status: same ? 'correct' : 'wrong', score: same ? worth : 0, max: worth }
  }

  const right = key.filter((expected, i) => matches(expected, given[i] ?? '')).length
  const score = Math.round((worth * right * 100) / key.length) / 100
  const status = right === key.length ? 'correct' : right > 0 ? 'partial' : 'wrong'
  return { status, score, max: worth }
}

/** Whether a written answer matches the key, ignoring case, width, spacing and the order of listed labels. */
export function matches(expected: string, given: string): boolean {
  const g = normalize(given)
  if (!g) return false
  return alternatives(expected).some((alt) => {
    const e = normalize(alt)
    if (e === g) return true
    const el = labelList(e), gl = labelList(g)
    return el !== null && gl !== null && sameSet(el, gl)
  })
}

/** "A or B", "A / B" and "A 或 B" accept either. */
function alternatives(expected: string): string[] {
  return expected.split(/\s+or\s+|\s+\/\s+|\s*或\s*/i).filter((s) => s.trim())
}

function normalize(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[(（[]\s*(.+?)\s*[)）\]]$/, '$1')
    .replace(/[.。,，;；]$/, '')
}

/** "d, e, f" → ["d","e","f"]; null when the text is not a list of short labels. */
function labelList(s: string): string[] | null {
  const parts = s.split(/[\s,，、;；]+/).filter(Boolean)
  return parts.length > 1 && parts.every((p) => /^[\p{L}\p{N}]{1,3}$/u.test(p)) ? parts : null
}

function sameSet(a: string[], b: string[]): boolean {
  const x = [...new Set(a.filter(Boolean))].sort()
  const y = [...new Set(b.filter(Boolean))].sort()
  return x.length === y.length && x.every((v, i) => v === y[i])
}

export interface QuizSummary {
  grades: Grade[]
  score: number
  max: number
  correct: number
  /** Open answers still waiting for the person to mark them. */
  pending: number
}

export function summarize(attempt: Pick<QuizAttempt, 'items' | 'responses' | 'markings'>): QuizSummary {
  const grades = attempt.items.map((item, i) => grade(item.question, attempt.responses[i] ?? null, attempt.markings[i] ?? null))
  const round = (n: number) => Math.round(n * 100) / 100
  return {
    grades,
    score: round(grades.reduce((n, g) => n + g.score, 0)),
    max: round(grades.reduce((n, g) => n + g.max, 0)),
    correct: grades.filter((g) => g.status === 'correct').length,
    pending: grades.filter((g) => g.status === 'pending').length,
  }
}

/** A timed exam that has run out accepts no more answers. */
export function isOver(attempt: Pick<QuizAttempt, 'finishedAt' | 'deadline'>, now = new Date()): boolean {
  return attempt.finishedAt !== null || (attempt.deadline !== null && now >= new Date(attempt.deadline))
}

/** Display label for a stored option label in this quiz. */
export function displayLabel(item: QuizItem, label: string): string {
  const i = item.optionOrder.indexOf(label)
  return i >= 0 ? item.displayLabels[i]! : label
}
