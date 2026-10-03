'use client'

import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { DraftExam, DraftQuestion } from '@exam/core'
import type { Strength } from '@exam/models'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { QuestionEditor } from '@/features/questions/QuestionEditor'
import { QuestionView } from '@/features/questions/QuestionView'
import { Glide } from '@/shared/motion/Glide'
import { Fab, type FabAction } from '@/shared/chrome/Fab'
import { FigureView } from '@/shared/FigureView'
import { Menu, menuItem } from '@/shared/chrome/Menu'
import {
  IconAlert,
  IconBack,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconCloud,
  IconCloudCheck,
  IconEdit,
  IconGrip,
  IconLoader,
  IconMerge,
  IconOutline,
  IconPlus,
  IconSave,
  IconSplit,
  IconStrength,
  IconTrash,
  IconUndo,
  IconX,
} from '@/shared/icons'
import { TYPE_LABELS } from '@/shared/labels'
import { Markdown } from '@/shared/Markdown'
import { Toast } from '@/shared/Toast'
import { MathTextInput } from '@/shared/math/MathTextInput'
import { Badge, Button, inputClass } from '@/shared/ui'
import { publishDraft, saveDraft } from './actions'
import { PageViewer } from './PageViewer'
import { STRENGTH_LABELS } from '@/features/settings/strengths'
import { mergeParts, splitNumber, splitParts } from './parts'
import { StrengthPanel } from './StrengthPanel'
import { ActiveOverlay, alongList, EdgeScroll, listMeasuring, Sortable, underPointer, useDragSensors, type DragHandle } from './sortable'

type SaveState = 'saved' | 'dirty' | 'saving'

// Questions have no ids of their own while in review; these keep each one's identity while it is dragged around.
let lastKey = 0
const newKey = () => `q${++lastKey}`

/** How the wide-screen workspace is laid out, remembered on this device. */
interface Layout {
  outline: boolean
  /** Share of the width (outline aside) that the exam pages take. */
  split: number
}
const LAYOUT_KEY = 'review-layout'
const DEFAULT_LAYOUT: Layout = { outline: false, split: 0.55 }
const clampSplit = (n: number) => Math.min(0.72, Math.max(0.3, n))

/**
 * Review workspace, full screen: an optional question outline, every source page one under the other
 * (the divider next to them sets how wide they are) and the extracted questions, which can be dragged
 * into order. One slim toolbar on top and a floating action button for the common moves.
 * Every edit is saved as a draft automatically; "存入題庫" puts the questions in the bank.
 */
export function ReviewEditor({
  importId,
  initial,
  pages,
  savedExam,
  notice,
  heading,
  strength,
}: {
  importId: string
  initial: DraftExam
  pages: { pageNumber: number; image: string }[]
  /** The exam this import was already saved as. */
  savedExam: { id: string; questionCount: number } | null
  notice?: React.ReactNode
  /** Title in the toolbar; a short details line and page actions (menu rows) in its menu. */
  heading: { title: string; meta?: string; menu?: React.ReactNode }
  /** The AI strength from settings; given, the floating button can change it. */
  strength?: Strength
}) {
  const [draft, setDraft] = useState(initial)
  const [selected, setSelected] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [layout, setLayoutState] = useState(DEFAULT_LAYOUT)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [published, setPublished] = useState(savedExam ? { count: savedExam.questionCount, examId: savedExam.id } : null)
  // The draft as it was last put in the bank: until it changes, there is nothing to update.
  const [inBank, setInBank] = useState<DraftExam | null>(savedExam ? initial : null)
  const inSync = inBank === draft
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [publishing, startPublish] = useTransition()
  // Phones show one side at a time.
  const [mobileView, setMobileView] = useState<'questions' | 'page'>('questions')
  const cards = useRef(new Map<number, HTMLElement>())
  const keys = useRef<string[]>([])
  if (keys.current.length !== draft.questions.length) keys.current = draft.questions.map((_, i) => keys.current[i] ?? newKey())
  const cardSensors = useDragSensors(true, true)
  const outlineSensors = useDragSensors(false)
  const row = useRef<HTMLDivElement>(null)
  const viewer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? 'null') as Partial<Layout> | null
      if (saved) setLayoutState({ outline: saved.outline === true, split: clampSplit(Number(saved.split) || DEFAULT_LAYOUT.split) })
    } catch {}
  }, [])
  const setLayout = (patch: Partial<Layout>) =>
    setLayoutState((l) => {
      const next = { ...l, ...patch }
      try {
        localStorage.setItem(LAYOUT_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
  // The toolbar wraps to more lines on narrow screens; the page viewer and outline stick just below it.
  const bar = useRef<HTMLDivElement>(null)
  const [barHeight, setBarHeight] = useState(120)
  useEffect(() => {
    const el = bar.current
    if (!el) return
    const observer = new ResizeObserver(() => setBarHeight(el.offsetHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  // The number bar has no scrollbar: the wheel scrolls it sideways, and the chosen number stays in view.
  const numberBar = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = numberBar.current
    if (!el) return
    const wheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      el.scrollBy({ left: e.deltaY, behavior: 'instant' })
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [])
  useEffect(() => {
    const el = numberBar.current
    const chip = el?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!el || !chip) return
    const box = el.getBoundingClientRect()
    const c = chip.getBoundingClientRect()
    el.scrollTo({ left: el.scrollLeft + c.left - box.left - el.clientWidth / 2 + c.width / 2, behavior: 'smooth' })
  }, [selected])
  // Autosave shortly after the last edit.
  useEffect(() => {
    if (draft === initial) return
    setSaveState('dirty')
    const timer = setTimeout(async () => {
      setSaveState('saving')
      await saveDraft(importId, draft)
      setSaveState('saved')
    }, 800)
    return () => clearTimeout(timer)
  }, [draft, importId, initial])

  const select = (index: number, scroll: boolean) => {
    setSelected(index)
    if (!scroll) return
    setMobileView('questions')
    // Wait a frame so the question list is visible again on phones before scrolling to it.
    requestAnimationFrame(() => cards.current.get(index)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const updateQuestion = (index: number, q: DraftQuestion) => setDraft((d) => ({ ...d, questions: d.questions.map((x, i) => (i === index ? q : x)) }))
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
  // A number whose sub-questions are split heads them with its group card: picking the number shows that card.
  const selectGroup = (groupId: string, first: number) => {
    setSelected(first)
    setMobileView('questions')
    requestAnimationFrame(() => document.querySelector(`[data-group="${CSS.escape(groupId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
  // Deleting asks nothing; Ctrl+Z (or 復原 on the note) puts questions back, last deleted first.
  // A box moved on the original page goes on the same stack, so Ctrl+Z also puts it back.
  type Undo = { kind: 'delete'; index: number; question: DraftQuestion; key: string } | { kind: 'box'; key: string; locations: DraftQuestion['locations'] }
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
  const undoDelete = () => {
    const last = trash.current.pop()
    if (!last) return
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
  const undoRef = useRef(undoDelete)
  undoRef.current = undoDelete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z' || !trash.current.length) return
      // typing fields keep their own undo
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], math-field')) return
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
    const q: DraftQuestion = {
      number: after === undefined ? String(draft.questions.length + 1) : next,
      section: ref?.section ?? null,
      groupId: null,
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

  const publish = () =>
    startPublish(async () => {
      const snapshot = draft
      if (saveState !== 'saved') await saveDraft(importId, snapshot)
      setPublished(await publishDraft(importId, snapshot))
      setInBank(snapshot)
      setSaveState('saved')
    })

  const isFlagged = (q: DraftQuestion) => q.confidence !== 'high' || q.issues.length > 0
  const flagged = draft.questions.filter(isFlagged).length
  const meta = draft.meta
  const setMeta = (key: keyof typeof meta, value: string) => setDraft((d) => ({ ...d, meta: { ...d.meta, [key]: value.trim() ? value : null } }))
  const setGroupStem = (id: string, stem: string) => setDraft((d) => ({ ...d, groups: d.groups.map((g) => (g.id === id ? { ...g, stem } : g)) }))

  const nextFlagged = () => {
    const n = draft.questions.length
    const from = selected ?? -1
    for (let k = 1; k <= n; k++) {
      const i = (from + k) % n
      if (isFlagged(draft.questions[i]!)) return select(i, true)
    }
  }
  // The floating button holds what the page does not already show: undo (phones and tablets have
  // no Ctrl+Z), jumping to the next question to check, and actions on the selected question.
  const chosen = selected !== null ? draft.questions[selected] : undefined
  const chosenNumber = chosen ? chosen.number : ''
  const chosenGroup = chosen?.groupId ? draft.groups.find((g) => g.id === chosen.groupId) : undefined
  const canMerge = !!chosenGroup && !!mergeParts(chosenGroup, draft.questions.filter((q) => q.groupId === chosenGroup.id))
  const [strengthOpen, setStrengthOpen] = useState(false)
  // what the panel last saved, so the floating button's label follows it without a reload
  const [shownStrength, setShownStrength] = useState(strength ?? 'balanced')
  const fabActions: FabAction[] = [
    ...(flagged > 0 ? [{ id: 'next', label: '下一題待確認', icon: <IconAlert size={19} />, badge: flagged, onClick: nextFlagged }] : []),
    ...(chosen && selected !== null
      ? [
          ...(splitParts(chosen, '') ? [{ id: 'split', label: `把第 ${chosenNumber} 題拆成小題`, icon: <IconSplit size={19} />, onClick: () => splitQuestion(selected) }] : []),
          ...(canMerge ? [{ id: 'merge', label: `把第 ${splitNumber(chosenNumber).main} 題的小題合併`, icon: <IconMerge size={19} />, onClick: () => mergeGroup(chosenGroup!.id) }] : []),
          { id: 'copy', label: `複製第 ${chosenNumber} 題`, icon: <IconCopy size={19} />, onClick: () => duplicateQuestion(selected) },
          { id: 'insert', label: `在第 ${chosenNumber} 題後面新增`, icon: <IconPlus size={20} />, onClick: () => addQuestion(selected) },
        ]
      : [{ id: 'add', label: '新增題目', icon: <IconPlus size={20} />, onClick: () => addQuestion() }]),
    ...(strength
      ? [{ id: 'strength', label: `AI 強度：${STRENGTH_LABELS.find(([v]) => v === shownStrength)![1]}`, icon: <IconStrength size={19} />, onClick: () => setStrengthOpen(true) }]
      : []),
    { id: 'undo', label: '復原上一步', icon: <IconUndo size={19} />, onClick: undoDelete, disabled: !trash.current.length },
  ]

  const metaFields = (compact: boolean) =>
    (
      [
        ['title', '考卷名稱'],
        ['subject', '科目'],
        ['institution', '學校'],
        ['term', '學期'],
      ] as const
    ).map(([key, label]) => (
      <label key={key} className="block text-sm">
        <span className={`block font-medium text-muted ${compact ? 'mb-0.5 text-[11px]' : 'mb-1 text-xs'}`}>{label}</span>
        <input value={meta[key] ?? ''} onChange={(e) => setMeta(key, e.target.value)} className={`${inputClass} ${compact ? 'py-1.5 text-[13px]' : ''}`} />
      </label>
    ))

  const visibleKeys = keys.current.filter((_, i) => !flaggedOnly || isFlagged(draft.questions[i]!))

  // Dragging the divider between the pages and the questions sets how much room the pages get.
  const startResize = (e: React.PointerEvent) => {
    const r = row.current
    const v = viewer.current
    if (!r || !v || e.button !== 0) return
    e.preventDefault()
    const left = v.getBoundingClientRect().left
    const room = r.clientWidth - (layout.outline ? OUTLINE_SPACE : 0) - SPLITTER
    const move = (ev: PointerEvent) => setLayoutState((l) => ({ ...l, split: clampSplit((ev.clientX - left) / room) }))
    const up = () => {
      removeEventListener('pointermove', move)
      removeEventListener('pointerup', up)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
      setLayout({})
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    addEventListener('pointermove', move)
    addEventListener('pointerup', up)
  }

  const iconButton = 'm-press grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/[0.05] hover:text-ink'
  // A card's buttons when it is not being edited; the dragged copy draws the same row (inert) so it lines up.
  const viewActions = (q: DraftQuestion, index: number, handle: DragHandle | null) => (
    <>
      {!q.groupId && splitParts(q, '') && (
        <button type="button" onClick={() => splitQuestion(index)} className={iconButton} aria-label="拆成小題" title="拆成小題：(a)(b) 各自一題，可以分別作答和計分">
          <IconSplit size={15} />
        </button>
      )}
      <button type="button" onClick={() => setEditing(index)} className={iconButton} aria-label="編輯" title="編輯（或點兩下題目）">
        <IconEdit size={15} />
      </button>
      <button type="button" onClick={() => removeQuestion(index)} className={`${iconButton} hover:bg-bad-soft hover:text-bad`} aria-label="刪除" title="刪除">
        <IconTrash size={15} />
      </button>
      {handle ? (
        gripButton(q, handle)
      ) : (
        <span className={iconButton.replace('text-muted', 'text-accent')}>
          <IconGrip size={16} />
        </span>
      )}
    </>
  )
  const gripButton = (q: DraftQuestion, handle: DragHandle) => (
    <button
      type="button"
      {...handle}
      className={`${iconButton} cursor-grab touch-none active:cursor-grabbing`}
      aria-label={`拖曳第 ${q.number} 題來排序`}
      title="拖曳排序"
    >
      <IconGrip size={16} />
    </button>
  )

  return (
    <div className="workspace">
      {/* One slim bar: the way back and the exam's menu, the question numbers, then review state and saving. */}
      <div ref={bar} className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2 sm:px-5">
          <div className="flex min-w-0 flex-1 items-center gap-1 lg:max-w-[22rem] lg:flex-none">
            <Link href="/imports" className={iconButton} aria-label="回到匯入列表" title="回到匯入列表">
              <IconBack size={18} />
            </Link>
            <button
              type="button"
              onClick={() => setLayout({ outline: !layout.outline })}
              aria-pressed={layout.outline}
              className={`${iconButton} hidden lg:grid ${layout.outline ? 'bg-ink/[0.06] text-ink' : ''}`}
              aria-label={layout.outline ? '收起題目大綱' : '顯示題目大綱'}
              title={layout.outline ? '收起題目大綱' : '顯示題目大綱'}
            >
              <IconOutline size={17} />
            </button>
            <h1 className="sr-only">{heading.title}</h1>
            <Menu
              label="考卷選單"
              className="m-press flex max-w-full min-w-0 items-center gap-1 rounded-lg px-2 py-1 hover:bg-ink/[0.05]"
              button={
                <>
                  <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">{heading.title}</span>
                  <IconChevronDown size={15} className="shrink-0 text-muted" />
                </>
              }
            >
              {(close) => (
                <>
                  <div className="px-2.5 pb-2 pt-1.5">
                    <p className="font-medium leading-snug">{heading.title}</p>
                    {heading.meta && <p className="mt-0.5 text-xs text-muted">{heading.meta}</p>}
                  </div>
                  {published !== null && (
                    <Link href={`/bank/exams/${published.examId}`} role="menuitem" className={menuItem} onClick={close}>
                      <IconSave size={15} className="text-good" />
                      <span className="flex-1">在題庫查看</span>
                      <span className="num text-xs text-muted">{published.count} 題</span>
                    </Link>
                  )}
                  <button type="button" role="menuitem" className={`${menuItem} hidden lg:flex`} onClick={() => (setLayout({ outline: !layout.outline }), close())}>
                    <IconOutline size={15} className="text-muted" />
                    {layout.outline ? '收起題目大綱' : '題目大綱與考卷資訊'}
                  </button>
                  {heading.menu && <div className="mt-1 border-t border-line/70 pt-1">{heading.menu}</div>}
                </>
              )}
            </Menu>
          </div>

          {/* Question numbers: sub-questions sit together under their number. Below lg they get a row of their own. */}
          <div className="order-last flex min-w-0 basis-full items-center gap-2 lg:order-none lg:flex-1 lg:basis-0">
            <div className={`flex shrink-0 rounded-lg bg-ink/[0.06] p-0.5 text-sm lg:hidden ${pages.length ? '' : 'hidden'}`}>
              {(
                [
                  ['questions', '題目'],
                  ['page', '原卷'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMobileView(value)}
                  className={`rounded-md px-2.5 py-1 transition-colors ${mobileView === value ? 'bg-surface font-medium shadow-sm' : 'text-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <nav ref={numberBar} className="scroll-strip flex min-w-0 flex-1 overflow-x-auto" aria-label="題號">
              {/* centred while the numbers fit; once they overflow, the strip scrolls from the start */}
              <div className="mx-auto flex w-max items-center gap-1 py-0.5">
                {numberClusters(draft.questions).map((cluster) => {
                  const shown = cluster.items.filter((i) => !flaggedOnly || isFlagged(draft.questions[i]!))
                  if (!shown.length) return null
                  const tone = (i: number) =>
                    selected === i ? 'bg-accent text-on-accent' : isFlagged(draft.questions[i]!) ? 'bg-warn-soft text-warn hover:bg-hl/40' : 'text-muted hover:bg-ink/[0.05] hover:text-ink'
                  if (cluster.part === null)
                    return (
                      <button
                        key={keys.current[shown[0]!]}
                        type="button"
                        onClick={() => select(shown[0]!, true)}
                        aria-current={selected === shown[0] || undefined}
                        title={isFlagged(draft.questions[shown[0]!]!) ? '待確認' : undefined}
                        className={`num h-7 min-w-7 shrink-0 rounded-md px-1.5 text-xs transition-colors ${
                          selected === shown[0]
                            ? 'bg-accent text-on-accent'
                            : isFlagged(draft.questions[shown[0]!]!)
                              ? 'bg-warn-soft text-warn hover:bg-hl/40'
                              : 'bg-surface text-muted shadow-sheet hover:text-ink'
                        }`}
                      >
                        {cluster.main}
                      </button>
                    )
                  return (
                    <span key={keys.current[shown[0]!]} className="flex h-7 shrink-0 items-center gap-px rounded-md bg-surface pr-0.5 shadow-sheet" title={`第 ${cluster.main} 題的小題`}>
                      {/* the number itself opens the question's shared card; a hairline sets the parts apart */}
                      <button
                        type="button"
                        onClick={() => {
                          const groupId = draft.questions[shown[0]!]!.groupId
                          if (groupId) selectGroup(groupId, shown[0]!)
                          else select(shown[0]!, true)
                        }}
                        className="num h-full rounded-l-md pl-2 pr-1.5 text-xs text-ink/70 transition-colors hover:bg-ink/[0.05] hover:text-ink"
                      >
                        {cluster.main}
                      </button>
                      <span aria-hidden className="mr-1 h-3.5 w-px bg-line" />
                      {shown.map((i) => (
                        <button key={keys.current[i]} type="button" onClick={() => select(i, true)} aria-current={selected === i || undefined} className={`num h-6 min-w-6 rounded px-1 text-[11px] transition-colors ${tone(i)}`}>
                          {splitNumber(draft.questions[i]!.number).part}
                        </button>
                      ))}
                    </span>
                  )
                })}
              </div>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {flagged > 0 && (
              <button
                type="button"
                onClick={() => setFlaggedOnly(!flaggedOnly)}
                aria-pressed={flaggedOnly}
                aria-label={`${flagged} 題待確認`}
                title={flaggedOnly ? `顯示全部題目` : `${flagged} 題待確認：點一下只看這些`}
                className={`m-press flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-semibold ${flaggedOnly ? 'bg-hl text-night' : 'bg-warn-soft text-warn hover:bg-hl/40'}`}
              >
                <IconAlert size={14} strokeWidth={2.4} />
                <span className="num">{flagged}</span>
              </button>
            )}
            <span
              className={`grid h-8 w-8 place-items-center ${saveState === 'saved' ? 'text-muted/70' : 'text-accent'}`}
              title={SAVE_LABELS[saveState]}
              aria-label={SAVE_LABELS[saveState]}
              role="status"
            >
              {saveState === 'saved' ? <IconCloudCheck size={17} /> : saveState === 'saving' ? <IconLoader size={16} className="m-spin" /> : <IconCloud size={17} />}
            </span>
            {published !== null && inSync ? (
              <Link
                href={`/bank/exams/${published.examId}`}
                className="m-press flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-good hover:bg-good-soft max-sm:px-2"
                title={`${published.count} 題已存入題庫，點一下查看`}
              >
                <IconCheck size={15} strokeWidth={2.6} />
                <span className="max-sm:hidden">已存入</span>
              </Link>
            ) : (
              <Button
                variant="primary"
                className="h-8 px-3 py-0 max-sm:px-2"
                onClick={publish}
                disabled={publishing || !draft.questions.length}
                loading={publishing}
                icon={<IconSave size={16} />}
                aria-label={published !== null ? '更新題庫' : '存入題庫'}
              >
                <span className="max-sm:hidden">{publishing ? '存入中…' : published !== null ? '更新題庫' : '存入題庫'}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 py-4 sm:px-5">
        <div
          ref={row}
          className="lg:flex"
          style={{ '--bar': `${barHeight}px`, '--side': `${(layout.outline ? OUTLINE_SPACE : 0) + SPLITTER}px`, '--split': layout.split } as React.CSSProperties}
        >
          {layout.outline && (
            <Outline
              questions={draft.questions}
              keys={keys.current}
              visibleKeys={visibleKeys}
              sensors={outlineSensors}
              onDragEnd={onDragEnd}
              selected={selected}
              flaggedOnly={flaggedOnly}
              isFlagged={isFlagged}
              onSelect={(i) => select(i, true)}
              onAdd={() => addQuestion()}
              onClose={() => setLayout({ outline: false })}
              meta={metaFields(true)}
            />
          )}

          {/* An exam written from scratch has no original pages: the questions take the room. */}
          {pages.length > 0 && (
            <>
              <div
                ref={viewer}
                className={`lg:sticky lg:top-[calc(var(--bar)+1rem)] lg:block lg:h-[calc(100dvh-var(--bar)-1.5rem)] lg:w-[calc((100%_-_var(--side))_*_var(--split))] lg:shrink-0 lg:self-start ${mobileView === 'page' ? '' : 'hidden'}`}
              >
                <PageViewer
                  pages={pages}
                  questions={draft.questions}
                  selected={selected}
                  onSelect={(i) => select(i, true)}
                  onBoxChange={moveBox}
                  className="lg:h-full lg:overflow-auto lg:pr-1 [scrollbar-gutter:stable]"
                />
              </div>

              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="調整原卷寬度"
                aria-valuenow={Math.round(layout.split * 100)}
                aria-valuemin={30}
                aria-valuemax={72}
                tabIndex={0}
                title="拖曳調整原卷寬度，點兩下還原"
                onPointerDown={startResize}
                onDoubleClick={() => setLayout({ split: DEFAULT_LAYOUT.split })}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setLayout({ split: clampSplit(layout.split + (e.key === 'ArrowLeft' ? -0.02 : 0.02)) })
                }}
                className="group sticky top-[calc(var(--bar)+1rem)] hidden h-[calc(100dvh-var(--bar)-1.5rem)] w-5 shrink-0 cursor-col-resize touch-none items-center justify-center self-start outline-none lg:flex"
              >
                <span className="h-14 w-1 rounded-full bg-ink/10 transition-colors group-hover:bg-accent/60 group-focus-visible:bg-accent group-active:bg-accent" />
              </div>
            </>
          )}

          <div className={`min-w-0 flex-1 space-y-4 pb-24 lg:block ${pages.length ? '' : 'mx-auto max-w-3xl'} ${mobileView === 'questions' ? '' : 'hidden'}`}>
            {notice}
            {/* a new exam written from scratch starts with its details open: the title comes first */}
            <details open={(!pages.length && !initial.meta.title) || undefined} className={`group rounded-2xl bg-surface shadow-sheet ${layout.outline ? 'lg:hidden' : ''}`}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                <span className="font-medium">考卷資訊</span>
                <span className="min-w-0 flex-1 truncate text-muted">{[meta.subject, meta.institution, meta.term].filter(Boolean).join(' · ')}</span>
                <IconChevronDown size={16} className="text-muted transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <div className="m-expand grid gap-3 px-4 pb-4 sm:grid-cols-2">{metaFields(false)}</div>
            </details>

            <DndContext
              id="review-cards"
              sensors={cardSensors}
              collisionDetection={underPointer}
              modifiers={[alongList]}
              measuring={listMeasuring}
              autoScroll={false}
              onDragEnd={onDragEnd}
            >
              <EdgeScroll top={barHeight} />
              <SortableContext items={visibleKeys} strategy={verticalListSortingStrategy}>
                {draft.questions.map((q, index) => {
                  if (flaggedOnly && !isFlagged(q)) return null
                  const showSection = q.section && q.section !== draft.questions[index - 1]?.section
                  const group = q.groupId && q.groupId !== draft.questions[index - 1]?.groupId ? draft.groups.find((g) => g.id === q.groupId) : undefined
                  // Questions in a group hang under its shared text.
                  const inGroup = q.groupId !== null && draft.groups.some((g) => g.id === q.groupId)
                  const isEditing = editing === index
                  const key = keys.current[index]!
                  return (
                    <Sortable key={key} id={key}>
                      {(handle, dragging) => (
                        <>
                          {showSection && <h3 className="mb-2 mt-7 text-[13px] font-semibold tracking-wide text-muted">{q.section}</h3>}
                          {group && (
                            <GroupCard
                              group={group}
                              parts={draft.questions.filter((x) => x.groupId === group.id)}
                              onChange={(stem) => setGroupStem(group.id, stem)}
                              onSelect={() => select(index, false)}
                              onMerge={() => mergeGroup(group.id)}
                            />
                          )}
                          <section
                            ref={(el) => {
                              if (el) cards.current.set(index, el)
                              else cards.current.delete(index)
                            }}
                            onClick={() => !isEditing && select(index, false)}
                            onDoubleClick={() => !isEditing && setEditing(index)}
                            className={`relative scroll-mt-40 rounded-2xl bg-surface p-4 transition-shadow sm:p-5 ${
                              inGroup ? 'ml-4 before:absolute before:-left-3 before:-top-4 before:bottom-4 before:w-0.5 before:rounded-full before:bg-ink/10 sm:ml-7 sm:before:-left-4' : ''
                            } ${
                              // While dragged, the card stays as an empty slot of its own size while its full-size copy
                              // follows the pointer. It stays mounted: touch drags end on it.
                              dragging ? '!bg-accent-soft/60 outline-2 -outline-offset-2 outline-dashed outline-accent/35 [&>*]:invisible' : 'shadow-sheet'
                            } ${selected === index && !dragging ? 'ring-2 ring-accent/70' : ''}`}
                          >
                            {isFlagged(q) && <span aria-hidden className="absolute bottom-5 left-0 top-5 w-[3px] rounded-r-full bg-hl" />}
                            {isEditing ? (
                              <QuestionEditor
                                value={q}
                                onChange={(v) => updateQuestion(index, v)}
                                importId={importId}
                                actions={
                                  // the same places as the card's own buttons: done where edit was, then delete and the grip
                                  <>
                                    <button type="button" onClick={() => setEditing(null)} className={`${iconButton} !text-accent hover:bg-accent-soft`} aria-label="完成" title="完成">
                                      <IconCheck size={17} strokeWidth={2.6} />
                                    </button>
                                    <button type="button" onClick={() => removeQuestion(index)} className={`${iconButton} hover:bg-bad-soft hover:text-bad`} aria-label="刪除" title="刪除">
                                      <IconTrash size={15} />
                                    </button>
                                    {/* Phones keep the header on one line; cards are reordered outside editing there. */}
                                    <span className="hidden sm:contents">{gripButton(q, handle)}</span>
                                  </>
                                }
                              />
                            ) : (
                              <QuestionView
                                q={q}
                                onConfirm={() => confirmQuestion(index)}
                                actions={viewActions(q, index, handle)}
                              />
                            )}
                          </section>
                        </>
                      )}
                    </Sortable>
                  )
                })}
              </SortableContext>
              <ActiveOverlay
                render={(key) => {
                  const index = keys.current.indexOf(key)
                  const q = draft.questions[index]
                  return q ? (
                    <DragPreview
                      q={q}
                      inGroup={q.groupId !== null && draft.groups.some((g) => g.id === q.groupId)}
                      offset={cards.current.get(index)?.offsetTop ?? 0}
                      flagged={isFlagged(q)}
                      actions={viewActions(q, index, null)}
                    />
                  ) : null
                }}
              />
            </DndContext>

            {!draft.questions.length && (
              <p className="px-1 pt-2 text-sm text-muted">還沒有題目。新增一題後選題型、寫題目和答案，寫好的題目可以拖曳排序。</p>
            )}
            <Button onClick={() => addQuestion()} className="w-full border border-dashed border-ink/15 bg-transparent py-3 shadow-none" icon={<IconPlus size={16} />}>
              {draft.questions.length ? '新增題目' : '新增第一題'}
            </Button>
          </div>
        </div>
      </div>

      <Toast show={deletedNote !== null} action="復原" onAction={undoDelete}>
        已刪除第 {deletedNote} 題
      </Toast>

      <Fab actions={fabActions} badge={flagged || undefined} />
      {strength && <StrengthPanel open={strengthOpen} initial={shownStrength} onChange={setShownStrength} onClose={() => setStrengthOpen(false)} />}
    </div>
  )
}

/** Consecutive sub-questions of one number (11(a), 11(b)) form one cluster in the number bar. */
function numberClusters(questions: DraftQuestion[]): { main: string; part: string | null; items: number[] }[] {
  const out: { main: string; part: string | null; items: number[] }[] = []
  questions.forEach((q, i) => {
    const { main, part } = splitNumber(q.number)
    const last = out.at(-1)
    if (part !== null && last?.part !== null && last?.main === main) last.items.push(i)
    else out.push({ main: part === null ? q.number : main, part, items: [i] })
  })
  return out
}

/** Width the open outline takes (232px column and its gap), and the divider's. */
const OUTLINE_SPACE = 252
const SPLITTER = 20

const SAVE_LABELS: Record<SaveState, string> = { saved: '草稿已自動儲存', saving: '儲存中…', dirty: '有未儲存的修改' }

/** Short plain-text preview of a question stem for the outline. */
/**
 * The copy of a card that follows the pointer while it is dragged: the whole card as it looks,
 * same size and same buttons, lifted by its shadow only (`.m-lifted`). `offset` skips a section
 * heading or group text above the card; the drag measures from those.
 */
function DragPreview({ q, inGroup, offset, flagged, actions }: { q: DraftQuestion; inGroup: boolean; offset: number; flagged: boolean; actions: React.ReactNode }) {
  return (
    <div style={{ paddingTop: offset }} className={inGroup ? 'ml-4 sm:ml-7' : ''}>
      <div data-drag-overlay inert className="m-lifted relative cursor-grabbing rounded-2xl bg-surface p-4 sm:p-5">
        {flagged && <span aria-hidden className="absolute bottom-5 left-0 top-5 w-[3px] rounded-r-full bg-hl" />}
        <QuestionView q={q} onConfirm={() => {}} actions={actions} />
      </div>
    </div>
  )
}

function preview(stem: string) {
  return stem
    .replace(/\$\$?[^$]*\$\$?/g, '…')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/-{3,}/g, '')
    .replace(/[#*_`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Left column when opened: the exam's details and every question with its review state; rows can be dragged. */
function Outline({
  questions,
  keys,
  visibleKeys,
  sensors,
  onDragEnd,
  selected,
  flaggedOnly,
  isFlagged,
  onSelect,
  onAdd,
  onClose,
  meta,
}: {
  questions: DraftQuestion[]
  keys: string[]
  visibleKeys: string[]
  sensors: ReturnType<typeof useDragSensors>
  onDragEnd: (e: DragEndEvent) => void
  selected: number | null
  flaggedOnly: boolean
  isFlagged: (q: DraftQuestion) => boolean
  onSelect: (index: number) => void
  onAdd: () => void
  onClose: () => void
  meta: React.ReactNode
}) {
  return (
    <nav
      aria-label="題目大綱"
      className="m-enter -ml-2 mr-3 hidden w-[248px] shrink-0 space-y-6 self-start px-2 lg:sticky lg:top-[calc(var(--bar)+1rem)] lg:block lg:max-h-[calc(100dvh-var(--bar)-1.5rem)] lg:overflow-y-auto lg:pb-4 [scrollbar-gutter:stable]"
    >
      <section>
        <p className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold tracking-[0.12em] text-muted">
          考卷資訊
          <button type="button" onClick={onClose} className="m-press grid h-6 w-6 place-items-center rounded-md hover:bg-ink/[0.05] hover:text-ink" aria-label="收起題目大綱" title="收起題目大綱">
            <IconX size={14} />
          </button>
        </p>
        <div className="space-y-2.5 rounded-2xl bg-surface p-3 shadow-sheet">{meta}</div>
      </section>
      <section>
        <p className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold tracking-[0.12em] text-muted">
          題目 <span className="num tracking-normal">{questions.length}</span>
        </p>
        <DndContext id="review-outline" sensors={sensors} collisionDetection={underPointer} modifiers={[alongList]} measuring={listMeasuring} onDragEnd={onDragEnd}>
          <SortableContext items={visibleKeys} strategy={verticalListSortingStrategy}>
            <Glide>
            <ol className="space-y-px">
              {questions.map((q, index) => {
                if (flaggedOnly && !isFlagged(q)) return null
                const on = selected === index
                const section = q.section && q.section !== questions[index - 1]?.section ? q.section : null
                return (
                  <li key={keys[index]}>
                    {section && <p className="mb-1 mt-3 truncate px-2 text-[11px] text-muted/80">{section}</p>}
                    <Sortable id={keys[index]!}>
                      {(handle, dragging) => (
                        <button
                          type="button"
                          {...handle}
                          onClick={() => onSelect(index)}
                          title="點一下跳到這題，拖曳可以排序"
                          data-glide
                          className={`relative flex w-full touch-manipulation items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] ${
                            dragging ? 'bg-surface text-ink shadow-[0_12px_28px_-10px_rgb(22_24_43/0.35),0_0_0_1px_rgb(22_24_43/0.08)]' : on ? 'bg-surface text-ink shadow-sheet' : 'text-muted hover:text-ink'
                          }`}
                        >
                          <span className={`num w-6 shrink-0 text-right text-[12px] ${on ? 'text-accent' : ''}`}>{q.number}</span>
                          <span className="min-w-0 flex-1 truncate">{preview(q.stem) || TYPE_LABELS[q.type]}</span>
                          {isFlagged(q) ? (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-hl" title="待確認" />
                          ) : (
                            <IconCheck size={13} strokeWidth={2.6} className="shrink-0 text-good/70" aria-label="已確認" />
                          )}
                        </button>
                      )}
                    </Sortable>
                  </li>
                )
              })}
            </ol>
            </Glide>
          </SortableContext>
        </DndContext>
        <button type="button" onClick={onAdd} className="m-press mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted hover:bg-ink/[0.04] hover:text-accent">
          <IconPlus size={14} className="ml-2.5" /> 新增題目
        </button>
      </section>
    </nav>
  )
}

/**
 * A passage, figure or instruction shared by the questions after it, which hang under it. When they are
 * the sub-questions of one number, e.g. 11(a) and 11(b), it heads them as that question. Its text can be edited in place.
 */
function GroupCard({
  group,
  parts,
  onChange,
  onSelect,
  onMerge,
}: {
  group: DraftExam['groups'][number]
  parts: DraftQuestion[]
  onChange: (stem: string) => void
  /** Clicking the card picks its first question, so its box shows on the page. */
  onSelect: () => void
  /** Sub-questions of one number can be joined back into one question. */
  onMerge: () => void
}) {
  const [editing, setEditing] = useState(false)
  const numbers = parts.map((p) => splitNumber(p.number))
  const main = numbers.length && numbers.every((n) => n.part !== null && n.main === numbers[0]!.main) ? numbers[0]!.main : null
  const points = parts.every((p) => p.points !== null) ? parts.reduce((sum, p) => sum + p.points!, 0) : null
  return (
    <div data-group={group.id} onClick={() => !editing && onSelect()} className="relative mb-3 scroll-mt-40 rounded-2xl bg-surface/70 p-4 ring-1 ring-ink/[0.07]">
      <div className="mb-2 flex items-center gap-2">
        {main !== null ? <span className="num text-xl leading-none">{main}.</span> : <span className="text-xs font-medium text-muted">題組共用內容</span>}
        <Badge>{main !== null ? `${parts.length} 小題` : `${parts.length} 題`}</Badge>
        {main !== null && points !== null && <Badge>{Math.round(points * 100) / 100} 分</Badge>}
        <span className="ml-auto flex items-center gap-3">
          {main !== null && !editing && (
            <button
              type="button"
              onClick={(e) => (e.stopPropagation(), onMerge())}
              className="flex items-center gap-1 text-xs text-accent hover:underline"
              title="把小題合回一題"
            >
              <IconMerge size={13} />
              合併
            </button>
          )}
          <button type="button" onClick={(e) => (e.stopPropagation(), setEditing(!editing))} className="text-xs text-accent hover:underline">
            {editing ? '完成' : '編輯'}
          </button>
        </span>
      </div>
      {editing ? <MathTextInput value={group.stem} onChange={onChange} /> : group.stem.trim() ? <Markdown>{group.stem}</Markdown> : <p className="text-sm text-muted">（沒有共用內容）</p>}
      {group.figures.map((f, i) => (
        <FigureView key={i} figure={f} />
      ))}
    </div>
  )
}
