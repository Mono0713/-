import type { DraftExam, DraftQuestion } from '@exam/core'

import { splitNumber } from '../../shared/questionNumber'

export { splitNumber }

type Group = DraftExam['groups'][number]

const OPEN_TYPES: DraftQuestion['type'][] = ['calculation', 'short_answer', 'essay', 'other']

const SEQUENCES = [
  'abcdefghij'.split(''),
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
  ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'],
]

/**
 * Finds sub-question markers such as (a) (b) or (1) (2) in a stem, outside formulas, so "f(x)"
 * never counts. Returns where each part starts, or null without at least two in sequence.
 */
function findParts(stem: string): { label: string; start: number; end: number }[] | null {
  // Blank out formulas and code so markers inside them are not found.
  const masked = stem.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$|`[^`]*`/g, (m) => ' '.repeat(m.length))
  // Capital letters are left out: (A) (B) … in a stem are nearly always options.
  const found = [...masked.matchAll(/(^|[\s:：。.;；,，])[(（]([a-j]|\d{1,2}|[ivx]{1,4})[)）]/g)].map((m) => ({
    label: m[2]!,
    start: m.index! + m[1]!.length,
    end: m.index! + m[0].length,
  }))
  for (const sequence of SEQUENCES) {
    const run: typeof found = []
    for (const f of found) if (f.label === sequence[run.length]) run.push(f)
    if (run.length >= 2) return run
  }
  return null
}

/**
 * Splits a question whose stem holds sub-questions like "(a) … (b) …" into one question per part,
 * sharing the text before the first part (and the figures) as a group. Answers are shared out
 * when there is one per part, points evenly. Only open questions (calculation, short answer, essay, other)
 * are split. Null when the stem has no parts in sequence or the question already belongs to a group.
 */
export function splitParts(q: DraftQuestion, groupId: string): { group: Group; parts: DraftQuestion[] } | null {
  // Numbered blanks, matching rows and options look like parts but are not.
  if (q.groupId || !OPEN_TYPES.includes(q.type)) return null
  const found = findParts(q.stem)
  if (!found) return null
  const shared = q.stem.slice(0, found[0]!.start).trim()
  const stems = found.map((f, i) => q.stem.slice(f.end, found[i + 1]?.start ?? q.stem.length).trim())
  const answers = shareAnswers(q.answer.values, found.length)
  const translations = shareText(q.translation, found.length)
  const explanations = shareText(q.explanation, found.length)
  const points = q.points === null ? null : Math.round((q.points / found.length) * 100) / 100
  const group: Group = { id: groupId, stem: shared, figures: q.figures, pageNumber: q.locations[0]?.pageNumber ?? 1 }
  const parts = found.map((f, i) => ({
    ...q,
    number: `${q.number}(${f.label})`,
    groupId,
    stem: stems[i]!,
    translation: translations ? translations[i] || null : i === 0 ? q.translation : null,
    explanation: explanations ? explanations[i] || null : i === 0 ? q.explanation : null,
    figures: [],
    options: q.options.map((o) => ({ ...o })),
    answer: answers ? { ...q.answer, values: answers[i]! } : i === 0 ? q.answer : { values: [], source: 'none' as const },
    points,
    issues: answers || !q.answer.values.length || i > 0 ? [...q.issues] : [...q.issues, SPLIT_NOTE],
    locations: q.locations.map((l) => ({ ...l, bbox: { ...l.bbox } })),
  }))
  return { group, parts }
}

/** One answer list per part: given one value per part, or one text marked (a) … (b) … like the stem, or one line per part. */
function shareAnswers(values: string[], count: number): string[][] | null {
  if (!values.length) return Array.from({ length: count }, () => [])
  if (values.length === count) return values.map((v) => [unlabel(v)])
  if (values.length === 1) return shareText(values[0]!, count)?.map((v) => (v ? [v] : [])) ?? null
  return null
}

/** A text marked (a) … (b) … like the stem, or written one paragraph or line per part, cut into one text per part. */
function shareText(text: string | null, count: number): string[] | null {
  if (!text?.trim()) return null
  const found = findParts(text)
  if (found?.length === count) return found.map((f, i) => text.slice(f.end, found[i + 1]?.start ?? text.length).trim().replace(/[;；,，]$/, '').trim())
  for (const cut of [/\n\s*\n/, /\n/]) {
    const pieces = text.split(cut).map((t) => t.trim()).filter(Boolean)
    if (pieces.length === count) return pieces.map(unlabel)
  }
  return null
}

/** A part's own label in front of its text, once or repeated: "(1) (1) text" → "text". */
function unlabel(text: string): string {
  return text.replace(/^(?:\s*[(（](?:[a-j]|\d{1,2}|[ivx]{1,4})[)）])+\s*/, '').trim()
}

const SPLIT_NOTE = '拆成小題時沒辦法把答案分到各小題，請檢查答案'
const CONFIDENCE: DraftQuestion['confidence'][] = ['low', 'medium', 'high']

/**
 * Undoes splitParts: the sub-questions of one number (11(a), 11(b)) become one question again,
 * with the shared text first and each part's text after its marker. Answers and explanations are
 * written per part the same way, points are added up, and the lowest confidence wins. The parts'
 * first box stands for the question. Null unless every part carries the same number with a part label.
 */
export function mergeParts(group: Group, parts: DraftQuestion[]): DraftQuestion | null {
  const numbers = parts.map((p) => splitNumber(p.number))
  if (!parts.length || numbers.some((n) => n.part === null || n.main !== numbers[0]!.main)) return null
  const labelled = (texts: (string | null)[]) => {
    const kept = texts.map((t, i) => (t?.trim() ? `(${numbers[i]!.part}) ${unlabel(t)}` : null)).filter((t): t is string => t !== null)
    return kept.length ? kept : null
  }
  const first = parts[0]!
  const values = parts.map((p) => p.answer.values.filter((v) => v.trim()))
  const answered = values.some((v) => v.length)
  const explanation = labelled(parts.map((p) => p.explanation))
  const translation = labelled(parts.map((p) => p.translation))
  return {
    ...first,
    number: numbers[0]!.main,
    groupId: null,
    stem: [group.stem.trim(), ...parts.map((p, i) => `(${numbers[i]!.part}) ${p.stem.trim()}`)].filter(Boolean).join('\n\n'),
    figures: [...group.figures, ...parts.flatMap((p) => p.figures)],
    answer: answered ? { ...first.answer, values: [labelled(values.map((v) => v.join('、')))!.join('; ')] } : { values: [], source: 'none' },
    explanation: explanation ? explanation.join('\n\n') : null,
    translation: translation ? translation.join('\n\n') : null,
    points: parts.every((p) => p.points !== null) ? Math.round(parts.reduce((sum, p) => sum + p.points!, 0) * 100) / 100 : null,
    confidence: CONFIDENCE[Math.min(...parts.map((p) => CONFIDENCE.indexOf(p.confidence)))]!,
    issues: [...new Set(parts.flatMap((p) => p.issues))].filter((issue) => issue !== SPLIT_NOTE),
  }
}

/** The label after `part` in its sequence: a → b, 2 → 3, ii → iii. */
export function nextPart(part: string | null): string {
  if (part === null) return '2'
  for (const sequence of SEQUENCES) {
    const at = sequence.indexOf(part)
    if (at >= 0 && at + 1 < sequence.length) return sequence[at + 1]!
  }
  return /^\d+$/.test(part) ? String(Number(part) + 1) : `${part}'`
}

type Parts = Pick<DraftExam, 'groups' | 'questions'>

/**
 * Sub-questions read as separate questions (1(1), 1(2) one after another, in no group) get a group
 * of their own with no shared text, so they show and merge like parts split by hand.
 */
export function groupLooseParts<T extends Parts>(draft: T, newId: (n: number) => string): T {
  const questions = [...draft.questions]
  const groups = [...draft.groups]
  let i = 0
  while (i < questions.length) {
    const { main, part } = splitNumber(questions[i]!.number)
    let end = i
    while (part !== null && !questions[i]!.groupId && end + 1 < questions.length) {
      const next = questions[end + 1]!
      const n = splitNumber(next.number)
      if (next.groupId || n.part === null || n.main !== main) break
      end++
    }
    if (end > i) {
      const id = newId(groups.length)
      groups.push({ id, stem: '', figures: [], pageNumber: questions[i]!.locations[0]?.pageNumber ?? 1 })
      for (let k = i; k <= end; k++) questions[k] = { ...questions[k]!, groupId: id }
    }
    i = end + 1
  }
  return groups.length === draft.groups.length ? draft : { ...draft, groups, questions }
}

/**
 * Makes a question a sub-question of the one before it: it joins that question's group with the next
 * label, or the two start a group together (5 and 6 become 5(1) and 5(2)). Null for the first question.
 */
export function attachToPrevious<T extends Parts>(draft: T, index: number, newId: string): T | null {
  const prev = draft.questions[index - 1]
  const q = draft.questions[index]
  if (!prev || !q || (prev.groupId && prev.groupId === q.groupId)) return null
  const { main, part } = splitNumber(prev.number)
  const questions = [...draft.questions]
  let groups = draft.groups
  let groupId = prev.groupId
  if (!groupId || !groups.some((g) => g.id === groupId)) {
    groupId = newId
    groups = [...groups, { id: groupId, stem: '', figures: [], pageNumber: prev.locations[0]?.pageNumber ?? 1 }]
    questions[index - 1] = { ...prev, groupId, number: part === null ? `${main}(1)` : prev.number }
  }
  questions[index] = { ...q, groupId, number: `${main}(${nextPart(part ?? '1')})` }
  // a group left with no questions goes too
  const left = q.groupId && !questions.some((x) => x.groupId === q.groupId) ? q.groupId : null
  return { ...draft, groups: left ? groups.filter((g) => g.id !== left) : groups, questions }
}

/**
 * Takes a sub-question out of its group as a question of its own, numbered after the group and
 * placed right after its last part. A group left with one part ends: that part becomes a plain
 * question, with the group's shared text in front of its own.
 */
export function detachPart<T extends Parts>(draft: T, index: number): { draft: T; at: number } | null {
  const q = draft.questions[index]
  const group = q?.groupId ? draft.groups.find((g) => g.id === q.groupId) : undefined
  if (!q || !group) return null
  const { main } = splitNumber(q.number)
  const rest = draft.questions.filter((x, i) => i !== index)
  const last = rest.findLastIndex((x) => x.groupId === group.id)
  const alone: DraftQuestion = { ...q, groupId: null, number: /^\d+$/.test(main) ? String(Number(main) + 1) : main }
  const questions = [...rest.slice(0, last + 1), alone, ...rest.slice(last + 1)]
  const remaining = questions.flatMap((x, i) => (x.groupId === group.id ? [i] : []))
  let groups = draft.groups
  if (remaining.length <= 1) {
    groups = groups.filter((g) => g.id !== group.id)
    for (const i of remaining) {
      const x = questions[i]!
      questions[i] = { ...x, groupId: null, number: splitNumber(x.number).main, stem: [group.stem.trim(), x.stem].filter(Boolean).join('\n\n'), figures: [...group.figures, ...x.figures] }
    }
  }
  return { draft: { ...draft, groups, questions }, at: questions.indexOf(alone) }
}
