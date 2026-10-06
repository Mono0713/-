'use client'

import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { DraftExam, DraftQuestion } from '@exam/core'
import { useEffect, useRef, useState } from 'react'
import { attachToPrevious, detachPart, groupLooseParts, mergeParts, nextPart, splitNumber, splitParts } from './parts'

// Questions have no ids of their own while in review; these keep each one's identity while it is dragged around.
let lastKey = 0
const newKey = () => `q${++lastKey}`

export const isFlagged = (q: DraftQuestion) => q.confidence !== 'high' || q.issues.length > 0

// Deleting asks nothing; Ctrl+Z (or 復原 on the note) puts questions back, last deleted first.
// A box moved on the original page goes on the same stack, so Ctrl+Z also puts it back.
// An AI answer or explanation that replaced one already there goes on it too.
type Undo =
  | { kind: 'delete'; index: number; question: DraftQuestion; key: string }
  | { kind: 'box'; key: string; locations: DraftQuestion['locations'] }
  | { kind: 'replace'; key: string; question: DraftQuestion }

/**
 * The draft being reviewed and every edit to it: which question is selected or being edited,
 * adding, copying, moving, splitting into sub-questions and back, deleting with undo.
 * `showQuestions` brings the question list into view (phones show one side at a time).
 */
export function useReviewDraft(initial: DraftExam, showQuestions: () => void) {
  // Sub-questions read as separate questions (1(1), 1(2)) start out grouped, so they merge like split ones.
  const [start] = useState(() => groupLooseParts(initial, (n) => `parts-${Date.now().toString(36)}-${n}`))
  const [draft, setDraft] = useState(start)
  const [selected, setSelected] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const cards = useRef(new Map<number, HTMLElement>())
  const keys = useRef<string[]>([])
  if (keys.current.length !== draft.questions.length) keys.current = draft.questions.map((_, i) => keys.current[i] ?? newKey())

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

  const updateQuestion = (index: number, q: DraftQuestion) => setDraft((d) => ({ ...d, questions: d.questions.map((x, i) => (i === index ? q : x)) }))
  // Changes the question with this card key wherever it is now (it may have moved meanwhile), keeping later edits to the others.
  // `undoable`: Ctrl+Z (or 復原上一步) brings back the question as it was before the patch.
  const patchQuestion = (key: string, patch: (q: DraftQuestion) => DraftQuestion, undoable = false) =>
    setDraft((d) => {
      const index = keys.current.indexOf(key)
      if (index < 0) return d
      if (undoable && !trash.current.some((u) => u.kind === 'replace' && u.question === d.questions[index])) trash.current.push({ kind: 'replace', key, question: d.questions[index]! })
      return { ...d, questions: d.questions.map((x, i) => (i === index ? patch(x) : x)) }
    })
  const confirmQuestion = (index: number) => updateQuestion(index, { ...draft.questions[index]!, confidence: 'high', issues: [] })
  // "(a) … (b) …" in one question becomes one question per part under a shared group.
  const splitQuestion = (index: number) => {
    const result = splitParts(draft.questions[index]!, `split-${Date.now().toString(36)}`)
    if (!result) return
    keys.current = [...keys.current.slice(0, index), ...result.parts.map(() => newKey()), ...keys.current.slice(index + 1)]
    setDraft((d) => ({
      ...d,
      groups: [...d.groups, result.group],
      questions: [...d.questions.slice(0, index), ...result.parts, ...d.questions.slice(index + 1)],
    }))
    setEditing(null)
    setSelected(index)
  }
  // The sub-questions of one number go back to being one question (undoes splitQuestion).
  const mergeGroup = (groupId: string) => {
    const indices = draft.questions.flatMap((q, i) => (q.groupId === groupId ? [i] : []))
    const group = draft.groups.find((g) => g.id === groupId)
    const merged = group && mergeParts(group, indices.map((i) => draft.questions[i]!))
    if (!merged || !indices.length) return
    const at = indices[0]!
    const key = keys.current[at]!
    keys.current = [...keys.current.slice(0, at), key, ...keys.current.slice(at + 1).filter((_, j) => !indices.includes(at + 1 + j))]
    setDraft((d) => ({
      ...d,
      groups: d.groups.filter((g) => g.id !== groupId),
      questions: [...d.questions.slice(0, at), merged, ...d.questions.slice(at + 1).filter((q) => q.groupId !== groupId)],
    }))
    setEditing(null)
    setSelected(at)
  }
  // By hand: a question becomes a sub-question of the one before it, or leaves its group again.
  const attachPart = (index: number) => {
    const next = attachToPrevious(draft, index, `parts-${Date.now().toString(36)}`)
    if (!next) return
    setDraft(next)
    setSelected(index)
  }
  const detachQuestion = (index: number) => {
    const result = detachPart(draft, index)
    if (!result) return
    keys.current = arrayMove(keys.current, index, result.at)
    setDraft(result.draft)
    setEditing(null)
    setSelected(result.at)
  }

  const trash = useRef<Undo[]>([])
  const [deletedNote, setDeletedNote] = useState<string | null>(null)
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const showDeleted = (number: string | null) => {
    clearTimeout(noteTimer.current)
    setDeletedNote(number)
    if (number !== null) noteTimer.current = setTimeout(() => setDeletedNote(null), 5000)
  }
  const removeQuestion = (index: number) => {
    const question = draft.questions[index]!
    trash.current.push({ kind: 'delete', index, question, key: keys.current[index]! })
    keys.current = keys.current.filter((_, i) => i !== index)
    setDraft((d) => ({ ...d, questions: d.questions.filter((_, i) => i !== index) }))
    setEditing(null)
    setSelected(null)
    showDeleted(question.number)
  }
  const moveBox = (index: number, location: number, bbox: DraftQuestion['locations'][number]['bbox'], pageNumber?: number) => {
    const q = draft.questions[index]!
    trash.current.push({ kind: 'box', key: keys.current[index]!, locations: q.locations })
    updateQuestion(index, { ...q, locations: q.locations.map((l, i) => (i === location ? { ...l, bbox, manual: true, ...(pageNumber !== undefined && { pageNumber }) } : l)) })
  }
  const undo = () => {
    const last = trash.current.pop()
    if (!last) return
    if (last.kind === 'replace') {
      const index = keys.current.indexOf(last.key)
      if (index >= 0) {
        setDraft((d) => ({ ...d, questions: d.questions.map((q, i) => (i === index ? last.question : q)) }))
        setSelected(index)
      }
      return
    }
    if (last.kind === 'box') {
      const index = keys.current.indexOf(last.key)
      if (index >= 0) {
        setDraft((d) => ({ ...d, questions: d.questions.map((q, i) => (i === index ? { ...q, locations: last.locations } : q)) }))
        setSelected(index)
      }
      return
    }
    const at = Math.min(last.index, keys.current.length)
    keys.current = [...keys.current.slice(0, at), last.key, ...keys.current.slice(at)]
    setDraft((d) => ({ ...d, questions: [...d.questions.slice(0, at), last.question, ...d.questions.slice(at)] }))
    setSelected(at)
    showDeleted(null)
  }
  const undoRef = useRef(undo)
  undoRef.current = undo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z' || !trash.current.length) return
      // typing fields keep their own undo
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], math-field')) return
      e.preventDefault()
      undoRef.current()
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
    keys.current = arrayMove(keys.current, from, to)
    setDraft((d) => ({ ...d, questions: arrayMove(d.questions, from, to) }))
    setSelected(follow)
    setEditing(follow)
  }
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    moveQuestion(keys.current.indexOf(String(active.id)), keys.current.indexOf(String(over.id)))
  }
  // A blank question at the end, or right after `after` with the next number.
  const addQuestion = (after?: number) => {
    const at = after ?? draft.questions.length - 1
    const ref = draft.questions[at]
    const next = ref && /^\d+$/.test(splitNumber(ref.number).main) ? String(Number(splitNumber(ref.number).main) + 1) : String(draft.questions.length + 1)
    // added after a sub-question, it is the next sub-question of the same number
    const group = after !== undefined && ref?.groupId && draft.groups.some((g) => g.id === ref.groupId) ? ref.groupId : null
    const { main, part } = splitNumber(ref?.number ?? '')
    const q: DraftQuestion = {
      number: after === undefined ? String(draft.questions.length + 1) : group ? `${main}(${nextPart(part)})` : next,
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
    const q = draft.questions[index]!
    insertAt(index + 1, { ...structuredClone(q), groupId: q.groupId })
  }
  const insertAt = (at: number, q: DraftQuestion) => {
    keys.current = [...keys.current.slice(0, at), newKey(), ...keys.current.slice(at)]
    setDraft((d) => ({ ...d, questions: [...d.questions.slice(0, at), q, ...d.questions.slice(at)] }))
    setSelected(at)
    setEditing(at)
    requestAnimationFrame(() => cards.current.get(at)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const setMeta = (key: keyof DraftExam['meta'], value: string) => setDraft((d) => ({ ...d, meta: { ...d.meta, [key]: value.trim() ? value : null } }))
  const setGroupStem = (id: string, stem: string) => setDraft((d) => ({ ...d, groups: d.groups.map((g) => (g.id === id ? { ...g, stem } : g)) }))

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
    canUndo: trash.current.length > 0,
    deletedNote,
    onDragEnd,
    addQuestion,
    duplicateQuestion,
    setMeta,
    setGroupStem,
  }
}
