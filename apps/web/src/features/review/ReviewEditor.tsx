'use client'

import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { DraftExam, DraftQuestion } from '@exam/core'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { QuestionEditor } from '@/features/questions/QuestionEditor'
import { QuestionView } from '@/features/questions/QuestionView'
import { Fab, type FabAction } from '@/shared/chrome/Fab'
import { FigureView } from '@/shared/FigureView'
import { IconAlert, IconBack, IconCheck, IconChevronDown, IconEdit, IconFile, IconFilter, IconGrip, IconList, IconOutline, IconPlus, IconSave, IconTop, IconTrash, IconX } from '@/shared/icons'
import { TYPE_LABELS } from '@/shared/labels'
import { Markdown } from '@/shared/Markdown'
import { MathTextInput } from '@/shared/math/MathTextInput'
import { Button, inputClass } from '@/shared/ui'
import { publishDraft, saveDraft } from './actions'
import { PageViewer } from './PageViewer'
import { Sortable, underPointer, useDragSensors, type DragHandle } from './sortable'

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
}: {
  importId: string
  initial: DraftExam
  pages: { pageNumber: number; image: string }[]
  /** The exam this import was already saved as. */
  savedExam: { id: string; questionCount: number } | null
  notice?: React.ReactNode
  /** Title, status badge, a short details line and page actions, shown in the toolbar. */
  heading: { title: string; status: React.ReactNode; meta?: string; actions?: React.ReactNode }
}) {
  const [draft, setDraft] = useState(initial)
  const [selected, setSelected] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [layout, setLayoutState] = useState(DEFAULT_LAYOUT)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [published, setPublished] = useState(savedExam ? { count: savedExam.questionCount, examId: savedExam.id } : null)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [publishing, startPublish] = useTransition()
  // Phones show one side at a time.
  const [mobileView, setMobileView] = useState<'questions' | 'page'>('questions')
  const cards = useRef(new Map<number, HTMLElement>())
  const keys = useRef<string[]>([])
  if (keys.current.length !== draft.questions.length) keys.current = draft.questions.map((_, i) => keys.current[i] ?? newKey())
  const cardSensors = useDragSensors(true)
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
  const removeQuestion = (index: number) => {
    if (!confirm(`刪除第 ${draft.questions[index]!.number} 題？`)) return
    keys.current = keys.current.filter((_, i) => i !== index)
    setDraft((d) => ({ ...d, questions: d.questions.filter((_, i) => i !== index) }))
    setEditing(null)
    setSelected(null)
  }
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
  const addQuestion = () => {
    const last = draft.questions.at(-1)
    const q: DraftQuestion = {
      number: String(draft.questions.length + 1),
      section: last?.section ?? null,
      groupId: null,
      type: 'single_choice',
      stem: '',
      translation: null,
      options: [],
      answer: { values: [], source: 'none' },
      explanation: null,
      points: last?.points ?? null,
      figures: [],
      confidence: 'high',
      issues: [],
      locations: [],
    }
    keys.current = [...keys.current, newKey()]
    setDraft((d) => ({ ...d, questions: [...d.questions, q] }))
    setEditing(draft.questions.length)
  }

  const publish = () =>
    startPublish(async () => {
      if (saveState !== 'saved') await saveDraft(importId, draft)
      setPublished(await publishDraft(importId, draft))
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
  const fabActions: FabAction[] = [
    ...(flagged > 0
      ? [
          { id: 'next', label: '下一題待確認', icon: <IconAlert size={19} />, badge: flagged, onClick: nextFlagged },
          { id: 'filter', label: flaggedOnly ? '顯示全部題目' : '只看待確認', icon: <IconFilter size={19} />, onClick: () => setFlaggedOnly(!flaggedOnly) },
        ]
      : []),
    { id: 'add', label: '新增題目', icon: <IconPlus size={20} />, onClick: addQuestion },
    {
      id: 'view',
      label: mobileView === 'page' ? '看題目' : '看原卷',
      icon: mobileView === 'page' ? <IconList size={19} /> : <IconFile size={19} />,
      onClick: () => setMobileView(mobileView === 'page' ? 'questions' : 'page'),
      className: 'lg:hidden',
    },
    { id: 'top', label: '回到頂端', icon: <IconTop size={19} />, onClick: () => scrollTo({ top: 0, behavior: 'smooth' }) },
    { id: 'publish', label: published !== null ? '更新題庫' : '存入題庫', icon: <IconSave size={19} />, onClick: publish, primary: true, disabled: publishing || !draft.questions.length },
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
      {/* One slim bar: the way back, what this is, how far review got, and the save action. */}
      <div ref={bar} className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2 sm:px-5">
          <div className="flex min-w-0 flex-1 basis-60 items-center gap-1.5">
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
            <h1 className="ml-1.5 truncate text-[15px] font-semibold tracking-[-0.01em]" title={heading.title}>
              {heading.title}
            </h1>
            {heading.status}
            {heading.meta && <span className="hidden truncate text-xs text-muted md:inline">{heading.meta}</span>}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">
              <span className="num mr-0.5 text-ink">{draft.questions.length}</span> 題
            </span>
            {flagged > 0 && (
              <button
                type="button"
                onClick={() => setFlaggedOnly(!flaggedOnly)}
                aria-pressed={flaggedOnly}
                title={flaggedOnly ? '顯示全部題目' : '只看待確認的題目'}
                className={`m-press flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  flaggedOnly ? 'bg-amber-400 text-night' : 'bg-warn-soft text-warn hover:bg-amber-100'
                }`}
              >
                <IconFilter size={13} strokeWidth={2.4} />
                <span className="num">{flagged}</span> 待確認
              </button>
            )}
            <span className="flex items-center gap-1.5 text-xs text-muted" title={SAVE_LABELS[saveState]}>
              <span className={`h-1.5 w-1.5 rounded-full ${saveState === 'saved' ? 'bg-good' : saveState === 'saving' ? 'animate-pulse bg-accent' : 'bg-amber-400'}`} />
              <span className="hidden sm:inline">{SAVE_LABELS[saveState]}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-ink/[0.06] p-0.5 text-sm lg:hidden">
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
                  className={`rounded-md px-3 py-1 transition-colors ${mobileView === value ? 'bg-surface font-medium shadow-sm' : 'text-muted'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {published !== null && (
              <Link href={`/bank/exams/${published.examId}`} className="hidden text-sm text-good hover:underline sm:inline">
                已存入 <span className="num">{published.count}</span> 題 →
              </Link>
            )}
            <Button
              variant="primary"
              className="max-sm:hidden"
              onClick={publish}
              disabled={publishing || !draft.questions.length}
              loading={publishing}
              icon={<IconSave size={16} />}
            >
              {publishing ? '存入中…' : published !== null ? '更新題庫' : '存入題庫'}
            </Button>
            {heading.actions}
          </div>
        </div>
        {/* Question numbers; with the outline open, it lists them instead. */}
        <nav className={`flex gap-1 overflow-x-auto px-3 pb-2 sm:px-5 ${layout.outline ? 'lg:hidden' : ''}`} aria-label="題號">
          {draft.questions.map((q, index) =>
            flaggedOnly && !isFlagged(q) ? null : (
              <button
                key={keys.current[index]}
                type="button"
                onClick={() => select(index, true)}
                title={isFlagged(q) ? '待確認' : undefined}
                className={`num h-7 min-w-8 shrink-0 rounded-md px-1.5 text-xs transition-colors ${
                  selected === index
                    ? 'bg-accent text-white'
                    : isFlagged(q)
                      ? 'bg-warn-soft text-warn hover:bg-amber-100'
                      : 'bg-surface text-muted shadow-sheet hover:text-ink'
                }`}
              >
                {q.number}
              </button>
            ),
          )}
        </nav>
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
              onAdd={addQuestion}
              onClose={() => setLayout({ outline: false })}
              meta={metaFields(true)}
            />
          )}

          <div
            ref={viewer}
            className={`lg:sticky lg:top-[calc(var(--bar)+1rem)] lg:block lg:h-[calc(100dvh-var(--bar)-1.5rem)] lg:w-[calc((100%_-_var(--side))_*_var(--split))] lg:shrink-0 lg:self-start ${mobileView === 'page' ? '' : 'hidden'}`}
          >
            <PageViewer
              pages={pages}
              questions={draft.questions}
              selected={selected}
              onSelect={(i) => select(i, true)}
              className="lg:h-full lg:overflow-auto lg:pr-1"
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

          <div className={`min-w-0 flex-1 space-y-4 pb-24 lg:block ${mobileView === 'questions' ? '' : 'hidden'}`}>
            {notice}
            <details className={`group rounded-2xl bg-surface shadow-sheet ${layout.outline ? 'lg:hidden' : ''}`}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                <span className="font-medium">考卷資訊</span>
                <span className="min-w-0 flex-1 truncate text-muted">{[meta.subject, meta.institution, meta.term].filter(Boolean).join(' · ')}</span>
                <IconChevronDown size={16} className="text-muted transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <div className="m-expand grid gap-3 px-4 pb-4 sm:grid-cols-2">{metaFields(false)}</div>
            </details>

            <DndContext id="review-cards" sensors={cardSensors} collisionDetection={underPointer} onDragEnd={onDragEnd}>
              <SortableContext items={visibleKeys} strategy={verticalListSortingStrategy}>
                {draft.questions.map((q, index) => {
                  if (flaggedOnly && !isFlagged(q)) return null
                  const showSection = q.section && q.section !== draft.questions[index - 1]?.section
                  const group = q.groupId && q.groupId !== draft.questions[index - 1]?.groupId ? draft.groups.find((g) => g.id === q.groupId) : undefined
                  const isEditing = editing === index
                  const key = keys.current[index]!
                  return (
                    <Sortable key={key} id={key}>
                      {(handle, dragging) => (
                        <>
                          {showSection && <h3 className="mb-2 mt-7 text-[13px] font-semibold tracking-wide text-muted">{q.section}</h3>}
                          {group && <GroupCard group={group} onChange={(stem) => setGroupStem(group.id, stem)} />}
                          <section
                            ref={(el) => {
                              if (el) cards.current.set(index, el)
                              else cards.current.delete(index)
                            }}
                            onClick={() => !isEditing && select(index, false)}
                            onDoubleClick={() => !isEditing && setEditing(index)}
                            className={`relative scroll-mt-40 rounded-2xl bg-surface p-5 transition-shadow ${
                              dragging ? 'shadow-[0_24px_48px_-16px_rgb(22_24_43/0.35),0_0_0_1px_rgb(22_24_43/0.08)]' : 'shadow-sheet'
                            } ${selected === index ? 'ring-2 ring-accent/70' : ''}`}
                          >
                            {isFlagged(q) && <span aria-hidden className="absolute bottom-5 left-0 top-5 w-[3px] rounded-r-full bg-amber-400" />}
                            {isEditing ? (
                              <>
                                <div className="mb-4 flex items-center gap-1 border-b border-line/70 pb-3">
                                  <span className="mr-auto text-sm font-medium">
                                    編輯第 <span className="num">{q.number}</span> 題
                                  </span>
                                  <button type="button" onClick={() => removeQuestion(index)} className={`${iconButton} hover:bg-bad-soft hover:text-bad`} aria-label="刪除" title="刪除">
                                    <IconTrash size={15} />
                                  </button>
                                  {gripButton(q, handle)}
                                  <Button variant="primary" className="ml-1 px-3 py-1.5" onClick={() => setEditing(null)} icon={<IconCheck size={15} />}>
                                    完成
                                  </Button>
                                </div>
                                <QuestionEditor value={q} onChange={(v) => updateQuestion(index, v)} importId={importId} />
                              </>
                            ) : (
                              <QuestionView
                                q={q}
                                actions={
                                  <>
                                    {isFlagged(q) && (
                                      <button
                                        type="button"
                                        onClick={() => confirmQuestion(index)}
                                        className="m-press mr-1 flex h-8 items-center gap-1 rounded-lg bg-good-soft px-2.5 text-xs font-medium text-good hover:bg-good/15"
                                        title="內容沒問題：移除待確認提示"
                                      >
                                        <IconCheck size={14} strokeWidth={2.6} />
                                        確認
                                      </button>
                                    )}
                                    <button type="button" onClick={() => setEditing(index)} className={iconButton} aria-label="編輯" title="編輯（或點兩下題目）">
                                      <IconEdit size={15} />
                                    </button>
                                    <button type="button" onClick={() => removeQuestion(index)} className={`${iconButton} hover:bg-bad-soft hover:text-bad`} aria-label="刪除" title="刪除">
                                      <IconTrash size={15} />
                                    </button>
                                    {gripButton(q, handle)}
                                  </>
                                }
                              />
                            )}
                          </section>
                        </>
                      )}
                    </Sortable>
                  )
                })}
              </SortableContext>
            </DndContext>

            <Button onClick={addQuestion} className="w-full border border-dashed border-ink/15 bg-transparent py-3 shadow-none" icon={<IconPlus size={16} />}>
              新增題目
            </Button>
          </div>
        </div>
      </div>

      <Fab actions={fabActions} badge={flagged || undefined} />
    </div>
  )
}

/** Width the open outline takes (232px column and its gap), and the divider's. */
const OUTLINE_SPACE = 252
const SPLITTER = 20

const SAVE_LABELS: Record<SaveState, string> = { saved: '草稿已自動儲存', saving: '儲存中…', dirty: '有未儲存的修改' }

/** Short plain-text preview of a question stem for the outline. */
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
      className="m-enter mr-5 hidden w-[232px] shrink-0 space-y-6 self-start lg:sticky lg:top-[calc(var(--bar)+1rem)] lg:block lg:max-h-[calc(100dvh-var(--bar)-1.5rem)] lg:overflow-y-auto lg:pb-4"
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
        <DndContext id="review-outline" sensors={sensors} collisionDetection={underPointer} onDragEnd={onDragEnd}>
          <SortableContext items={visibleKeys} strategy={verticalListSortingStrategy}>
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
                          className={`flex w-full touch-manipulation items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] ${
                            dragging ? 'bg-surface text-ink shadow-[0_12px_28px_-10px_rgb(22_24_43/0.35),0_0_0_1px_rgb(22_24_43/0.08)]' : on ? 'bg-surface text-ink shadow-sheet' : 'text-muted hover:bg-ink/[0.04] hover:text-ink'
                          }`}
                        >
                          <span className={`num w-6 shrink-0 text-right text-[12px] ${on ? 'text-accent' : ''}`}>{q.number}</span>
                          <span className="min-w-0 flex-1 truncate">{preview(q.stem) || TYPE_LABELS[q.type]}</span>
                          {isFlagged(q) ? (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" title="待確認" />
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
          </SortableContext>
        </DndContext>
        <button type="button" onClick={onAdd} className="m-press mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted hover:bg-ink/[0.04] hover:text-accent">
          <IconPlus size={14} className="ml-2.5" /> 新增題目
        </button>
      </section>
    </nav>
  )
}

/** A passage or figure shared by the questions after it; its text can be edited in place. */
function GroupCard({ group, onChange }: { group: DraftExam['groups'][number]; onChange: (stem: string) => void }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="mb-3 rounded-2xl border border-dashed border-ink/15 bg-surface/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted">題組共用內容</span>
        <button type="button" onClick={() => setEditing(!editing)} className="text-xs text-accent hover:underline">
          {editing ? '完成' : '編輯'}
        </button>
      </div>
      {editing ? (
        <MathTextInput value={group.stem} onChange={onChange} />
      ) : (
        <Markdown>{group.stem}</Markdown>
      )}
      {group.figures.map((f, i) => (
        <FigureView key={i} figure={f} />
      ))}
    </div>
  )
}
