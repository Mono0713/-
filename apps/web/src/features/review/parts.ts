import type { DraftExam, DraftQuestion } from '@exam/core'

export { splitNumber } from '../../shared/questionNumber'

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
  const points = q.points === null ? null : Math.round((q.points / found.length) * 100) / 100
  const group: Group = { id: groupId, stem: shared, figures: q.figures, pageNumber: q.locations[0]?.pageNumber ?? 1 }
  const parts = found.map((f, i) => ({
    ...q,
    number: `${q.number}(${f.label})`,
    groupId,
    stem: stems[i]!,
    figures: [],
    options: q.options.map((o) => ({ ...o })),
    answer: answers ? { ...q.answer, values: answers[i]! } : i === 0 ? q.answer : { values: [], source: 'none' as const },
    points,
    issues: answers || !q.answer.values.length || i > 0 ? [...q.issues] : [...q.issues, '拆成小題時沒辦法把答案分到各小題，請檢查答案'],
    locations: q.locations.map((l) => ({ ...l, bbox: { ...l.bbox } })),
  }))
  return { group, parts }
}

/** One answer list per part: given one value per part, or one text marked (a) … (b) … like the stem. */
function shareAnswers(values: string[], count: number): string[][] | null {
  if (!values.length) return Array.from({ length: count }, () => [])
  if (values.length === count) return values.map((v) => [v])
  if (values.length === 1) {
    const found = findParts(values[0]!)
    if (found?.length === count) return found.map((f, i) => [values[0]!.slice(f.end, found[i + 1]?.start ?? values[0]!.length).trim().replace(/[;；,，。]$/, '')])
  }
  return null
}
