import { isPickMatching, matchingItemCount, type DraftFigure, type DraftQuestion } from '@exam/core'
import { isEmptyInk, practiceRows } from '@exam/ink'
import { numberValue, sameMath } from './equivalence.ts'
import type { Grade, QuizAttempt, QuizItem, QuizResponse, QuizSettings, Marking } from './types.ts'

/** How a question is answered in a quiz. */
export type AnswerKind =
  | { kind: 'single' }
  | { kind: 'multiple' }
  | { kind: 'true_false' }
  /**
   * One input per blank; figure blanks come first, drawn on the figure. pick: a matching
   * question whose items are each answered by picking one option label instead of typing.
   */
  | { kind: 'blanks'; count: number; figureBlanks: number; pick?: boolean }
  | { kind: 'text' }
  /** Writing practice: one row of the practice grid per character, written by hand only. */
  | { kind: 'writing'; rows: string[] }

export function answerKind(q: DraftQuestion): AnswerKind {
  const figureBlanks = q.figures.reduce((n, f) => n + (f.image?.blanks.length ?? f.blanks.length), 0)
  if (q.type === 'single_choice' && q.options.length) return { kind: 'single' }
  if (q.type === 'multiple_choice' && q.options.length) return { kind: 'multiple' }
  if (q.type === 'true_false') return { kind: 'true_false' }
  if (q.type === 'writing') return { kind: 'writing', rows: practiceRows(q.answer.values) }
  if (isPickMatching(q) && !figureBlanks) return { kind: 'blanks', count: matchingItemCount(q), figureBlanks: 0, pick: true }
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

/**
 * Lays out the chosen questions for one quiz, shuffling questions and options if asked.
 * Shuffled options of any question type are relabelled in the new order; answers typed
 * with the new labels are translated back when graded (see gradeItem).
 */
export function buildItems(sources: QuizSource[], settings: QuizSettings, random: () => number = Math.random): QuizItem[] {
  const ordered = settings.shuffleQuestions ? shuffle(sources, random) : sources
  return ordered.map(({ questionId, question, group }) => {
    const labels = question.options.map((o) => o.label)
    if (labels.length < 2 || !settings.shuffleOptions) return { questionId, question, group, optionOrder: labels, displayLabels: labels }
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

/** Marks an answer in a quiz, translating option labels typed in blanks back to the paper's labels. */
export function gradeItem(item: QuizItem, response: QuizResponse | null, marking: Marking | null = null): Grade {
  if (answerKind(item.question).kind !== 'blanks' || !response) return grade(item.question, response, marking)
  return grade(item.question, { values: response.values.map((v) => toPaperLabels(item, v)) }, marking)
}

/**
 * A typed answer made only of option labels as shown in this quiz ("B", "b, d") in
 * the paper's labels; any other text is returned unchanged.
 */
export function toPaperLabels(item: QuizItem, value: string): string {
  return mapLabels(value, item.displayLabels, item.optionOrder)
}

/** The reverse of toPaperLabels, for showing an answer key in this quiz's labels. */
export function toQuizLabels(item: QuizItem, value: string): string {
  return mapLabels(value, item.optionOrder, item.displayLabels)
}

function mapLabels(value: string, from: string[], to: string[]): string {
  if (from.every((label, i) => label === to[i])) return value
  const key = (s: string) => normalize(s)
  const lookup = new Map(from.map((label, i) => [key(label), to[i]!]))
  const parts = value.trim().split(/([\s,，、;；]+)/)
  const tokens = parts.filter((_, i) => i % 2 === 0)
  if (!tokens.length || !tokens.every((t) => lookup.has(key(t)))) return value
  return parts.map((p, i) => (i % 2 === 0 ? lookup.get(key(p))! : p)).join('')
}

/**
 * Marks one answer. Choice and true/false questions are checked against the key. Blanks and
 * short answers are checked too, forgiving format ("1/2" = "0.5"); what that cannot settle,
 * and every open answer, waits for a marking by the person or an AI teacher, which then decides.
 */
export function grade(q: DraftQuestion, response: QuizResponse | null, marking: Marking | null = null): Grade {
  const key = q.answer.values.filter((v) => v.trim())
  const worth = q.points ?? 1
  const given = response?.values ?? []
  const typed = given.some((v) => v.trim())
  const answered = typed || !isEmptyInk(response?.handwriting)
  const kind = answerKind(q)
  const choice = kind.kind === 'single' || kind.kind === 'multiple' || kind.kind === 'true_false'
  if (!answered) return key.length ? { status: 'unanswered', score: 0, max: worth } : { status: 'no_key', score: 0, max: 0 }
  // A marking settles anything the key cannot, including questions without a key.
  if (marking && !choice) return byMarking(marking, worth)
  if (!key.length) return { status: 'no_key', score: 0, max: 0 }
  // Handwriting nobody has read yet waits to be marked.
  if (!typed) return { status: 'pending', score: 0, max: worth }

  if (choice) {
    const same = sameSet(key.map(normalize), given.map(normalize))
    return { status: same ? 'correct' : 'wrong', score: same ? worth : 0, max: worth }
  }

  if (kind.kind === 'writing') return gradeWriting(kind.rows, given, worth)

  if (kind.kind === 'text') {
    // A short final answer ("8×10^6", "x = 1/2") can be matched; anything else needs marking.
    const text = given.join('\n')
    return key.some((k) => matches(k, text)) ? { status: 'correct', score: worth, max: worth } : { status: 'pending', score: 0, max: worth }
  }

  const right = key.filter((expected, i) => matches(expected, given[i] ?? '')).length
  const score = Math.round((worth * right * 100) / key.length) / 100
  const status = right === key.length ? 'correct' : right > 0 ? 'partial' : 'wrong'
  return { status, score, max: worth }
}

/**
 * A practice row counts when what the AI read in it is that character, written at least once
 * and nothing else ("?" stands for a character it could not recognise).
 */
function gradeWriting(rows: string[], read: string[], worth: number): Grade {
  if (!rows.length) return { status: 'no_key', score: 0, max: 0 }
  const right = rows.filter((char, i) => {
    const seen = Array.from((read[i] ?? '').normalize('NFKC').replace(/\s+/g, ''))
    return seen.length > 0 && seen.every((c) => c === char.normalize('NFKC'))
  }).length
  const score = Math.round((worth * right * 100) / rows.length) / 100
  return { status: right === rows.length ? 'correct' : right > 0 ? 'partial' : 'wrong', score, max: worth }
}

function byMarking(marking: Marking, worth: number): Grade {
  const credit = Math.min(1, Math.max(0, marking.credit))
  return { status: credit >= 1 ? 'correct' : credit <= 0 ? 'wrong' : 'partial', score: Math.round(worth * credit * 100) / 100, max: worth }
}

/**
 * Whether an answer is worth sending to an AI teacher: answered, not a choice question,
 * not already marked, and not already fully right by the key.
 */
export function needsTeacher(item: QuizItem, response: QuizResponse | null, marking: Marking | null): boolean {
  // Handwriting is read into values first (see @exam/grading), then judged like typing.
  if (marking || !response?.values.some((v) => v.trim())) return false
  const kind = answerKind(item.question).kind
  // Writing practice is judged from what was read (see gradeWriting); a teacher can still mark it by hand.
  if (kind === 'single' || kind === 'multiple' || kind === 'true_false' || kind === 'writing') return false
  const status = gradeItem(item, response, null).status
  if (status === 'correct' || status === 'unanswered') return false
  if (status === 'no_key' || (kind === 'text' && item.question.answer.values.filter((v) => v.trim()).length !== 1)) return true
  // Only answers the program cannot be sure are wrong: an option label or a number that differs from the key is simply wrong.
  const key = item.question.answer.values
  const given = kind === 'text' ? [response.values.join('\n')] : response.values.map((v) => toPaperLabels(item, v))
  const labels = new Set(item.optionOrder.map(normalize))
  return key.some((expected, i) => {
    const g = given[i] ?? ''
    if (!g.trim() || matches(expected, g)) return false
    const asLabels = (s: string) => (labelList(normalize(s)) ?? [normalize(s)]).every((l) => labels.has(l))
    if (labels.size && asLabels(g) && asLabels(expected)) return false
    return numberValue(g) === null || numberValue(expected) === null
  })
}

/** Whether a written answer matches the key, ignoring case, width, spacing, the order of listed labels and the form of a number or formula. */
export function matches(expected: string, given: string): boolean {
  const g = normalize(given)
  if (!g) return false
  return alternatives(expected).some((alt) => {
    const e = normalize(alt)
    if (e === g) return true
    const el = labelList(e), gl = labelList(g)
    if (el !== null && gl !== null && sameSet(el, gl)) return true
    return sameMath(alt, given)
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
  const grades = attempt.items.map((item, i) => gradeItem(item, attempt.responses[i] ?? null, attempt.markings[i] ?? null))
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

/**
 * Whether a question is written in another language than the reader's, judged by its script:
 * a Chinese, Japanese or Korean reader gets a translation for Latin text, others for CJK text.
 */
export function inOtherLanguage(q: Pick<DraftQuestion, 'stem' | 'options'>, locale: string): boolean {
  // formulas and code read the same in any language
  const text = [q.stem, ...q.options.map((o) => o.content)].join('\n').replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$|`[^`]*`/g, ' ')
  const cjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(text)
  const words = (text.match(/[A-Za-z]{3,}/g) ?? []).length
  return /^(zh|ja|ko)/.test(locale) ? !cjk && words >= 2 : cjk
}
