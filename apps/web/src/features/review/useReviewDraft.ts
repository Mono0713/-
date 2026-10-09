'use client'

import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { isWordBank, sheetOf, syncWordBanks, withWordBanks, type DraftExam, type DraftQuestion, type ExamSheet, type Option } from '@exam/core'
import { useEffect, useRef, useState } from 'react'
import { attachToPrevious, detachPart, groupLooseParts, mergeParts, nextPart, splitNumber, splitParts } from './parts'
import { useHistory } from './useHistory'

// Questions have no ids of their own while in review; these keep each one's identity while it is dragged around.
let lastKey = 0
const newKey = () => `q${++lastKey}`

export const isFlagged = (q: DraftQuestion) => q.confidence !== 'high' || q.issues.length > 0

type State = { draft: DraftExam; keys: string[] }

/**
 * The draft being reviewed and every edit to it: which question is selected or being edited,
 * adding, copying, moving, splitting into sub-questions and back, deleting. Every edit can be
 * undone and redone (Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y, or 復原上一步), many steps back; typing in one
 * box is one step until it pauses. `showQuestions` brings the question list into view (phones show one side at a time).
 */
export function useReviewDraft(initial: DraftExam, showQuestions: () => void) {
  // Sub-questions read as separate questions (1(1), 1(2)) start out grouped, so they merge like split ones.
  // A word box read as one choice question per sentence, each repeating the box, becomes one 選詞填空.
  const [start] = useState(() => withWordBanks(groupLooseParts(initial, (n) => `parts-${Date.now().toString(36)}-${n}`)))
  const [draft, setDraft] = useState(start)
  const [selected, setSelected] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const cards = useRef(new Map<number, HTMLElement>())
  const keys = useRef<string[]>([])
  const history = useHistory<State>(
    () => {
      keys.current = start.questions.map(() => newKey())
      return { draft: start, keys: keys.current }
    },
    (state) => {
      keys.current = state.keys
      setDraft(state.draft)
    },
  )
  /** Every edit goes through here, from the latest draft (AI replies land while other edits happen). */
  const edit = (next: (d: DraftExam, k: string[]) => Partial<State> | null, step?: { tag?: string; focus?: string }) =>
    history.change((s) => {
      const result = next(s.draft, s.keys)
      // the questions of a word box always carry the box as their options
      return result ? { draft: syncWordBanks(result.draft ?? s.draft), keys: result.keys ?? s.keys } : s
    }, step)
  const latest = () => history.now.current

  const select = (index: number, scroll: boolean) => {
    setSelected(index)
    if (!scroll) return
    showQuestions()
    // Wait a frame so the question list is visible again on phones before scrolling to it.
    requestAnimationFrame(() => cards.current.get(index)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }
  // A number whose sub-questions are split heads them with its group card: picking the number shows that card.
  const selectGroup = (groupId: string, first: number) => {
    setSelected(first)
    showQuestions()
    requestAnimationFrame(() => document.querySelector(`[data-group="${CSS.escape(groupId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const replaceAt = (d: DraftExam, index: number, q: DraftQuestion) => ({ draft: { ...d, questions: d.questions.map((x, i) => (i === index ? q : x)) } })
  // From the question form: typing in it is one undo step until it pauses.
  const updateQuestion = (index: number, q: DraftQuestion) => {
    const key = latest().keys[index]
    edit((d) => replaceAt(d, index, q), { tag: `type:q:${key}`, focus: key })
  }
  // Changes the question with this card key wherever it is now (it may have moved meanwhile).
  // Patches with the same `tag` (one AI run over the whole exam) are undone together.
  const patchQuestion = (key: string, patch: (q: DraftQuestion) => DraftQuestion, tag?: string) =>
    edit(
      (d, k) => {
        const index = k.indexOf(key)
        const q = index < 0 ? null : patch(d.questions[index]!)
        return q && q !== d.questions[index] ? replaceAt(d, index, q) : null
      },
      { tag, focus: key },
    )
  const confirmQuestion = (index: number) => {
    const key = latest().keys[index]
    edit((d) => replaceAt(d, index, { ...d.questions[index]!, confidence: 'high', issues: [] }), { focus: key })
  }
  // "(a) … (b) …" in one question becomes one question per part under a shared group.
  const splitQuestion = (index: number) => {
    const { draft: d, keys: k } = latest()
    const result = splitParts(d.questions[index]!, `split-${Date.now().toString(36)}`)
    if (!result) return
    edit(
      () => ({
        keys: [...k.slice(0, index), ...result.parts.map(() => newKey()), ...k.slice(index + 1)],
        draft: { ...d, groups: [...d.groups, result.group], questions: [...d.questions.slice(0, index), ...result.parts, ...d.questions.slice(index + 1)] },
      }),
      { focus: k[index] },
    )
    setEditing(null)
    setSelected(index)
  }
  // The sub-questions of one number go back to being one question (undoes splitQuestion).
  const mergeGroup = (groupId: string) => {
    const { draft: d, keys: k } = latest()
    const indices = d.questions.flatMap((q, i) => (q.groupId === groupId ? [i] : []))
    const group = d.groups.find((g) => g.id === groupId)
    const merged = group && mergeParts(group, indices.map((i) => d.questions[i]!))
    if (!merged || !indices.length) return
    const at = indices[0]!
    edit(
      () => ({
        keys: k.filter((_, i) => i === at || !indices.includes(i)),
        draft: {
          ...d,
          groups: d.groups.filter((g) => g.id !== groupId),
          questions: [...d.questions.slice(0, at), merged, ...d.questions.slice(at + 1).filter((q) => q.groupId !== groupId)],
        },
      }),
      { focus: k[at] },
    )
    setEditing(null)
    setSelected(at)
  }
  // By hand: a question becomes a sub-question of the one before it, or leaves its group again.
  const attachPart = (index: number) => {
    const next = attachToPrevious(latest().draft, index, `parts-${Date.now().toString(36)}`)
    if (!next) return
    edit(() => ({ draft: next }), { focus: latest().keys[index] })
    setSelected(index)
  }
  const detachQuestion = (index: number) => {
    const { draft: d, keys: k } = latest()
    const result = detachPart(d, index)
    if (!result) return
    edit(() => ({ draft: result.draft, keys: arrayMove(k, index, result.at) }), { focus: k[index] })
    setEditing(null)
    setSelected(result.at)
  }

  const [deletedNote, setDeletedNote] = useState<string | null>(null)
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const showDeleted = (number: string | null) => {
    clearTimeout(noteTimer.current)
    setDeletedNote(number)
    if (number !== null) noteTimer.current = setTimeout(() => setDeletedNote(null), 5000)
  }
  const removeQuestion = (index: number) => {
    const { draft: d, keys: k } = latest()
    const question = d.questions[index]!
    edit(() => ({ keys: k.filter((_, i) => i !== index), draft: { ...d, questions: d.questions.filter((_, i) => i !== index) } }), { focus: k[index] })
    setEditing(null)
    setSelected(null)
    showDeleted(question.number)
  }
  const moveBox = (index: number, location: number, bbox: DraftQuestion['locations'][number]['bbox'], pageNumber?: number) => {
    const key = latest().keys[index]
    edit((d) => {
      const q = d.questions[index]!
      // a question added by hand has no box until one is drawn for it
      const locations = q.locations[location]
        ? q.locations.map((l, i) => (i === location ? { ...l, bbox, manual: true, ...(pageNumber !== undefined && { pageNumber }) } : l))
        : [...q.locations, { pageNumber: pageNumber ?? 1, bbox, manual: true }]
      return replaceAt(d, index, { ...q, locations })
    }, { focus: key })
  }

  // After undo or redo: the step's question is selected and brought into view; selection and the
  // open form stay on their question if it is still there.
  const land = (step: { focus?: string } | null, before: string[]) => {
    if (!step) return
    const now = latest().keys
    const follow = (i: number | null) => {
      const at = i === null ? -1 : now.indexOf(before[i] ?? '')
      return at >= 0 ? at : null
    }
    setEditing(follow)
    const at = step.focus ? now.indexOf(step.focus) : -1
    if (at >= 0) {
      setSelected(at)
      requestAnimationFrame(() => cards.current.get(at)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    } else setSelected(follow)
    showDeleted(null)
  }
  const undo = () => {
    const before = latest().keys
    land(history.undo(), before)
  }
  const redo = () => {
    const before = latest().keys
    land(history.redo(), before)
  }
  const keysRef = useRef({ undo, redo })
  keysRef.current = { undo, redo }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const key = e.key.toLowerCase()
      const back = key === 'z' && !e.shiftKey
      const forward = (key === 'z' && e.shiftKey) || key === 'y'
      if (!back && !forward) return
      // a formula being edited keeps its own undo
      if ((e.target as HTMLElement | null)?.closest?.('math-field')) return
      e.preventDefault()
      if (back) keysRef.current.undo()
      else keysRef.current.redo()
    }
    addEventListener('keydown', onKey)
    return () => {
      removeEventListener('keydown', onKey)
      clearTimeout(noteTimer.current)
    }
  }, [])

  const moveQuestion = (from: number, to: number) => {
    // Selection and editing follow the question that moved.
    const follow = (i: number | null) =>
      i === null ? null : i === from ? to : from < to && i > from && i <= to ? i - 1 : from > to && i >= to && i < from ? i + 1 : i
    edit((d, k) => ({ keys: arrayMove(k, from, to), draft: { ...d, questions: arrayMove(d.questions, from, to) } }), { focus: latest().keys[from] })
    setSelected(follow)
    setEditing(follow)
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const k = latest().keys
    moveQuestion(k.indexOf(String(active.id)), k.indexOf(String(over.id)))
  }
  // A blank question at the end, or right after `after` with the next number.
  const addQuestion = (after?: number) => {
    const d = latest().draft
    const at = after ?? d.questions.length - 1
    const ref = d.questions[at]
    const next = ref && /^\d+$/.test(splitNumber(ref.number).main) ? String(Number(splitNumber(ref.number).main) + 1) : String(d.questions.length + 1)
    // added after a sub-question, it is the next sub-question of the same number
    const group = after !== undefined && ref?.groupId && d.groups.some((g) => g.id === ref.groupId) ? ref.groupId : null
    // a sentence added under a word box keeps the plain numbering (8, 9, 10) and picks from the box
    const bank = isWordBank(d.groups.find((g) => g.id === group))
    const { main, part } = splitNumber(ref?.number ?? '')
    const q: DraftQuestion = {
      number: after === undefined ? String(d.questions.length + 1) : group && !bank ? `${main}(${nextPart(part)})` : next,
      section: ref?.section ?? null,
      groupId: group,
      type: 'single_choice',
      stem: '',
      translation: null,
      options: [],
      answer: { values: [], source: 'none' },
      explanation: null,
      points: ref?.points ?? null,
      figures: [],
      confidence: 'high',
      issues: [],
      locations: [],
    }
    insertAt(at + 1, q)
  }
  // A copy right after the question, for one that differs only a little.
  const duplicateQuestion = (index: number) => {
    const q = latest().draft.questions[index]!
    insertAt(index + 1, { ...structuredClone(q), groupId: q.groupId })
  }
  const insertAt = (at: number, q: DraftQuestion) => {
    const key = newKey()
    edit((d, k) => ({ keys: [...k.slice(0, at), key, ...k.slice(at)], draft: { ...d, questions: [...d.questions.slice(0, at), q, ...d.questions.slice(at)] } }), { focus: key })
    setSelected(at)
    setEditing(at)
    requestAnimationFrame(() => cards.current.get(at)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const setMeta = (key: keyof DraftExam['meta'], value: string) => edit((d) => ({ draft: { ...d, meta: { ...d.meta, [key]: value.trim() ? value : null } } }), { tag: `type:meta:${key}` })
  /** `typing` names a text box, so its keystrokes join one undo step; a switch is a step of its own. */
  const setSheet = (patch: Partial<ExamSheet>, typing?: string) => edit((d) => ({ draft: { ...d, sheet: { ...sheetOf(d), ...patch } } }), typing ? { tag: `type:sheet:${typing}` } : undefined)
  const setGroupStem = (id: string, stem: string) => edit((d) => ({ draft: { ...d, groups: d.groups.map((g) => (g.id === id ? { ...g, stem } : g)) } }), { tag: `type:group:${id}` })
  // A word box: its questions take the new list (see edit); typing in it is one step until it pauses.
  const setGroupOptions = (id: string, options: Option[]) =>
    edit((d) => ({ draft: { ...d, groups: d.groups.map((g) => (g.id === id ? { ...g, options: options.length ? options : null } : g)) } }), { tag: `type:box:${id}` })
  /**
   * 選詞填空 chosen as a question's type: the question gets a word box of its own (its options, or A–D to fill in),
   * or its group gets one, and the sentences added after it pick from the same box.
   */
  const makeWordBank = (index: number) =>
    edit((d) => {
      const q = d.questions[index]
      if (!q) return null
      const options = q.options.length ? q.options : [...'ABCD'].map((label) => ({ label, content: '' }))
      if (q.groupId && d.groups.some((g) => g.id === q.groupId)) return { draft: { ...d, groups: d.groups.map((g) => (g.id === q.groupId ? { ...g, options } : g)) } }
      const id = `wordbox-${Date.now().toString(36)}`
      const group = { id, stem: '', figures: [], options, pageNumber: q.locations[0]?.pageNumber ?? 1 }
      return { draft: { ...d, groups: [...d.groups, group], questions: d.questions.map((x, i) => (i === index ? { ...x, groupId: id } : x)) } }
    })

  return {
    /** The draft as first shown (sub-questions grouped), before any edit. */
    start,
    draft,
    keys,
    cards,
    selected,
    select,
    selectGroup,
    editing,
    setEditing,
    updateQuestion,
    patchQuestion,
    confirmQuestion,
    splitQuestion,
    mergeGroup,
    attachPart,
    detachQuestion,
    removeQuestion,
    moveBox,
    undo,
    redo,
    canUndo: history.canUndo,
    deletedNote,
    onDragEnd,
    addQuestion,
    duplicateQuestion,
    setMeta,
    setSheet,
    setGroupStem,
    setGroupOptions,
    makeWordBank,
  }
}
