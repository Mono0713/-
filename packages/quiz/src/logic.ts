import { isPickAnswer, matchingItemCount, questionFigures, type DraftFigure, type DraftQuestion } from '@exam/core'
import { isEmptyInk, practiceRows } from '@exam/ink'
import { numberValue, sameMath, withinTolerance } from './equivalence.ts'
import type { Grade, QuizAttempt, QuizItem, QuizResponse, QuizSettings, Marking } from './types.ts'

/** How a question is answered in a quiz. */
export type AnswerKind =
  | { kind: 'single' }
  | { kind: 'multiple' }
  | { kind: 'true_false' }
  /**
   * One input per blank; figure blanks come first, drawn on the figure. pick: each blank or
   * item is answered by picking one option label instead of typing (配合題, or blanks filled
   * from a list of labels).
   */
  | { kind: 'blanks'; count: number; figureBlanks: number; pick?: boolean }
  | { kind: 'text' }
  /** Writing practice: one row of the practice grid per character, written by hand only. */
  | { kind: 'writing'; rows: string[] }

export function answerKind(q: DraftQuestion): AnswerKind {
  const figureBlanks = questionFigures(q).reduce((n, f) => n + (f.image?.blanks.length ?? f.blanks.length), 0)
  if (q.type === 'single_choice' && q.options.length) return { kind: 'single' }
  if (q.type === 'multiple_choice' && q.options.length) return { kind: 'multiple' }
  if (q.type === 'true_false') return { kind: 'true_false' }
  if (q.type === 'writing') return { kind: 'writing', rows: practiceRows(q.answer.values) }
  if (isPickAnswer(q)) {
    return { kind: 'blanks', count: Math.max(figureBlanks || matchingItemCount(q), q.answer.values.length), figureBlanks, pick: true }
  }
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
  // A reading passage's questions move as one block, so they stay together and in order.
  const ordered = settings.shuffleQuestions ? shuffle(groupRuns(sources), random).flat() : sources
  return ordered.map(({ questionId, question, group }) => {
    const labels = question.options.map((o) => o.label)
    const partial = settings.multiplePartial && question.type === 'multiple_choice' ? { partial: true } : {}
    if (labels.length < 2 || !settings.shuffleOptions) return { questionId, question, group, optionOrder: labels, displayLabels: labels, ...partial }
    const optionOrder = shuffle(labels, random)
    return { questionId, question, group, optionOrder, displayLabels: relabel(labels), ...partial }
  })
}

/** Splits questions into runs that share a passage or group (one run per question outside any group). */
export function groupRuns<T extends Pick<QuizSource, 'question' | 'group'>>(sources: T[]): T[][] {
  const runs: T[][] = []
  for (const s of sources) {
    const last = runs.at(-1)?.at(-1)
    if (last && sameGroup(last, s)) runs.at(-1)!.push(s)
    else runs.push([s])
  }
  return runs
}

/** Whether two questions next to each other belong to the same passage or group. */
export function sameGroup(a: Pick<QuizSource, 'question' | 'group'>, b: Pick<QuizSource, 'question' | 'group'>): boolean {
  return a.group !== null && b.group !== null && a.question.groupId !== null && a.question.groupId === b.question.groupId && a.group.stem === b.group.stem
}

/** First and last position of the passage questions around `index`, or null when it shares its passage with none. */
export function groupRange(items: Pick<QuizSource, 'question' | 'group'>[], index: number): [number, number] | null {
  let first = index
  let last = index
  while (first > 0 && sameGroup(items[first - 1]!, items[first]!)) first--
  while (last < items.length - 1 && sameGroup(items[last]!, items[last + 1]!)) last++
  return first === last ? null : [first, last]
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
  if (answerKind(item.question).kind !== 'blanks' || !response) return grade(item.question, response, marking, item.partial)
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
 * With `partial`, a multiple-choice answer earns part of its points (see multipleScore).
 */
export function grade(q: DraftQuestion, response: QuizResponse | null, marking: Marking | null = null, partial = false): Grade {
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

  if (kind.kind === 'multiple' && partial) return multipleScore(q, key.map(normalize), given.map(normalize), worth)

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
 * The 學測 rule for multiple choice: every option is one decision, and each option picked
 * wrongly or missed takes 2/n of the points (n options), down to nothing.
 */
function multipleScore(q: DraftQuestion, key: string[], given: string[], worth: number): Grade {
  const n = q.options.length
  const options = q.options.map((o) => normalize(o.label))
  const wrong = options.filter((l) => key.includes(l) !== given.includes(l)).length
  const share = Math.max(0, (n - 2 * wrong) / n)
  const score = Math.round(worth * share * 100) / 100
  return { status: wrong === 0 ? 'correct' : score > 0 ? 'partial' : 'wrong', score, max: worth }
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
  // A printed marking rule (一個錯字扣一分) can give part of the points to an answer the key alone calls wrong.
  if (item.question.markingRule?.trim()) return true
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
    return withinTolerance(alt, given) || sameMath(alt, given)
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
