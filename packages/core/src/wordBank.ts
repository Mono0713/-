import type { Option } from './schema.ts'
import { joinCarriedGroups } from './carried.ts'
import type { DraftExam, DraftQuestion } from './types.ts'

type Group = DraftExam['groups'][number]

/**
 * 選詞填空: a word box (or list of choices) printed once for several numbered questions, each of which
 * fills its blank with one label from the box. The box lives on the group; each of its questions keeps
 * a copy of it as its own options, so marking, the quiz and the bank treat them as option-label blanks.
 */
export function isWordBank(group: Pick<Group, 'options'> | null | undefined): boolean {
  return (group?.options?.length ?? 0) > 0
}

/** The questions of a word box take its options and are answered by picking a label into their blank. */
export function asWordBankQuestion(q: DraftQuestion, options: Option[]): DraftQuestion {
  // a blank written "__" or "\_\_" is answered in place like "___"
  const stem = q.stem.replace(/(?:\\_){2,}|(?<!_)__(?!_)/g, '___')
  return { ...q, type: 'fill_in_blank', stem, options: options.map((o) => ({ ...o })) }
}

const MIN_RUN = 3
const MIN_OPTIONS = 4
const sameOptions = (a: Option[], b: Option[]) => a.length === b.length && a.every((o, i) => o.label === b[i]!.label && o.content.trim() === b[i]!.content.trim())

/**
 * Finds word boxes read the old way, then hands every box to its questions (syncWordBanks); the same
 * draft when nothing changed. A run of at least three single-choice or fill-in questions in a row, each with one blank (___),
 * repeating the same list of four or more options (how recognition used to read a word box), becomes
 * one word box: the list moves onto their group, or a new group named after the run's first question.
 */
export function withWordBanks<T extends Pick<DraftExam, 'groups' | 'questions'>>(original: T): T {
  // questions carried onto the next page first rejoin their group (a passage, a box, sub-questions)
  const draft = joinCarriedGroups(original)
  let changed = draft !== original
  const groups = draft.groups.map((g) => ({ ...g }))
  let questions = draft.questions

  // Runs that repeat one list become word boxes.
  const candidate = (q: DraftQuestion) =>
    (q.type === 'single_choice' || q.type === 'fill_in_blank') && q.options.length >= MIN_OPTIONS && (q.stem.replace(/\\_/g, '_').match(/_{2,}/g)?.length ?? 0) === 1 && q.answer.values.length <= 1 && !q.figures.some((f) => f.option)
  const inBank = (q: DraftQuestion) => isWordBank(groups.find((g) => g.id === q.groupId))
  for (let i = 0; i < questions.length; ) {
    const first = questions[i]!
    let end = i + 1
    if (candidate(first) && !inBank(first)) {
      while (end < questions.length) {
        const q = questions[end]!
        if (!candidate(q) || q.groupId !== first.groupId || q.section !== first.section || !sameOptions(q.options, first.options)) break
        end++
      }
    }
    const run = end - i
    // A group already holding other questions (a reading passage) is left as it is.
    const whole = first.groupId === null || questions.filter((q) => q.groupId === first.groupId).length === run
    if (run >= MIN_RUN && whole) {
      let id = first.groupId
      const existing = groups.find((g) => g.id === id)
      if (existing) existing.options = first.options.map((o) => ({ ...o }))
      else {
        const page = first.locations[0]?.pageNumber ?? 1
        id = `wordbox-${page}-${first.number}`
        for (let n = 2; groups.some((g) => g.id === id); n++) id = `wordbox-${page}-${first.number}-${n}`
        groups.push({ id, stem: '', figures: [], options: first.options.map((o) => ({ ...o })), pageNumber: page })
      }
      questions = [...questions.slice(0, i), ...questions.slice(i, end).map((q) => ({ ...q, groupId: id })), ...questions.slice(end)]
      changed = true
    }
    i = end
  }

  // A sentence carried over onto the next page joins the box above it: each page is read on its own,
  // so its reader never saw the box and returns the sentence alone, without options.
  for (let i = 1; i < questions.length; i++) {
    const prev = questions[i - 1]!
    const q = questions[i]!
    if (!inBank(prev) || (q.groupId && groups.some((g) => g.id === q.groupId)) || !continues(prev, q)) continue
    questions = questions.map((x, k) => (k === i ? { ...x, groupId: prev.groupId } : x))
    changed = true
  }

  return syncWordBanks(changed ? { ...draft, groups, questions } : draft)
}

/**
 * Whether `q`, read with no box of its own, is the next sentence of the box `prev` belongs to: the next
 * number in the same section (or at the top of the next page), one blank, and no options or the box's own.
 */
function continues(prev: DraftQuestion, q: DraftQuestion): boolean {
  if (q.type !== 'fill_in_blank' && q.type !== 'single_choice' && q.type !== 'short_answer') return false
  // a new page may name the section a little differently; on the same page a new heading ends the box
  const newPage = Math.min(...q.locations.map((l) => l.pageNumber)) > Math.max(...prev.locations.map((l) => l.pageNumber))
  if (q.section !== null && q.section !== prev.section && !newPage) return false
  if (!/^\d+$/.test(prev.number) || q.number !== String(Number(prev.number) + 1)) return false
  if ((q.stem.replace(/\\_/g, '_').match(/_{2,}/g)?.length ?? 0) !== 1) return false
  return q.options.length === 0 || sameOptions(q.options, prev.options)
}

/** Every question of a word box carries the box as its options; the same draft when they already do. */
export function syncWordBanks<T extends Pick<DraftExam, 'groups' | 'questions'>>(draft: T): T {
  let changed = false
  const questions = draft.questions.map((q) => {
    const group = q.groupId ? draft.groups.find((g) => g.id === q.groupId) : undefined
    if (!group || !isWordBank(group)) return q
    if (q.type === 'fill_in_blank' && sameOptions(q.options, group.options!)) return q
    changed = true
    return asWordBankQuestion(q, group.options!)
  })
  return changed ? { ...draft, questions } : draft
}
