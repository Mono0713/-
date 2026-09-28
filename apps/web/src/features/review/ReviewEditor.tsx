'use client'

import type { DraftExam, DraftQuestion } from '@exam/core'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { QuestionEditor } from '@/features/questions/QuestionEditor'
import { QuestionView } from '@/features/questions/QuestionView'
import { Fab, type FabAction } from '@/shared/chrome/Fab'
import { FigureView } from '@/shared/FigureView'
import { IconAlert, IconArrowDown, IconArrowUp, IconCheck, IconChevronDown, IconEdit, IconFile, IconFilter, IconList, IconPlus, IconSave, IconTop, IconTrash } from '@/shared/icons'
import { TYPE_LABELS } from '@/shared/labels'
import { Markdown } from '@/shared/Markdown'
import { Button, inputClass } from '@/shared/ui'
import { publishDraft, saveDraft } from './actions'
import { PageViewer } from './PageViewer'

type SaveState = 'saved' | 'dirty' | 'saving'

/**
 * Review workspace: the question outline (wide screens), the source page and the extracted questions,
 * under one slim toolbar, with a floating action button for the common moves.
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
  const [pageNumber, setPageNumber] = useState(pages[0]?.pageNumber ?? 1)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [published, setPublished] = useState(savedExam ? { count: savedExam.questionCount, examId: savedExam.id } : null)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [publishing, startPublish] = useTransition()
  // Phones show one side at a time.
  const [mobileView, setMobileView] = useState<'questions' | 'page'>('questions')
  const cards = useRef(new Map<number, HTMLElement>())
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
    const page = draft.questions[index]?.locations[0]?.pageNumber
    if (page) setPageNumber(page)
    if (!scroll) return
    setMobileView('questions')
    // Wait a frame so the question list is visible again on phones before scrolling to it.
    requestAnimationFrame(() => cards.current.get(index)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }

  const updateQuestion = (index: number, q: DraftQuestion) => setDraft((d) => ({ ...d, questions: d.questions.map((x, i) => (i === index ? q : x)) }))
  const removeQuestion = (index: number) => {
    if (!confirm(`刪除第 ${draft.questions[index]!.number} 題？`)) return
    setDraft((d) => ({ ...d, questions: d.questions.filter((_, i) => i !== index) }))
    setEditing(null)
    setSelected(null)
  }
  const moveQuestion = (index: number, by: number) =>
    setDraft((d) => {
      const questions = [...d.questions]
      const [q] = questions.splice(index, 1)
      questions.splice(index + by, 0, q!)
      return { ...d, questions }
    })
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

  return (
    <div className="workspace">
      {/* One slim bar: what this is, how far review got, and the save action. */}
      <div ref={bar} className="sticky top-14 z-30 border-b border-line bg-paper/90 backdrop-blur-md xl:top-0">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 flex-1 basis-60 items-center gap-2.5">
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.01em]" title={heading.title}>
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
        {/* Question numbers; wide screens show them in the outline column instead. */}
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2.5 sm:px-6 min-[90rem]:hidden" aria-label="題號">
          {draft.questions.map((q, index) =>
            flaggedOnly && !isFlagged(q) ? null : (
              <button
                key={index}
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

      <div
        className="grid grid-cols-1 gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] min-[90rem]:grid-cols-[236px_minmax(0,5fr)_minmax(0,6fr)] 2xl:gap-8"
        style={{ '--bar': `${barHeight}px` } as React.CSSProperties}
      >
        <Outline
          questions={draft.questions}
          selected={selected}
          flaggedOnly={flaggedOnly}
          isFlagged={isFlagged}
          onSelect={(i) => select(i, true)}
          onAdd={addQuestion}
          meta={metaFields(true)}
        />

        <aside
          className={`lg:sticky lg:top-[calc(var(--bar)+4.75rem)] lg:block lg:max-h-[calc(100vh-var(--bar)-6rem)] lg:self-start lg:overflow-auto xl:top-[calc(var(--bar)+1.25rem)] xl:max-h-[calc(100vh-var(--bar)-2.5rem)] ${mobileView === 'page' ? '' : 'hidden'}`}
        >
          <PageViewer pages={pages} pageNumber={pageNumber} onPageChange={setPageNumber} questions={draft.questions} selected={selected} onSelect={(i) => select(i, true)} />
        </aside>

        <div className={`min-w-0 space-y-4 pb-24 lg:block ${mobileView === 'questions' ? '' : 'hidden'}`}>
          {notice}
          <details className="group rounded-2xl bg-surface shadow-sheet min-[90rem]:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
              <span className="font-medium">考卷資訊</span>
              <span className="min-w-0 flex-1 truncate text-muted">{[meta.subject, meta.institution, meta.term].filter(Boolean).join(' · ')}</span>
              <IconChevronDown size={16} className="text-muted transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div className="m-expand grid gap-3 px-4 pb-4 sm:grid-cols-2">{metaFields(false)}</div>
          </details>

          {draft.questions.map((q, index) => {
            if (flaggedOnly && !isFlagged(q)) return null
            const showSection = q.section && q.section !== draft.questions[index - 1]?.section
            const group = q.groupId && q.groupId !== draft.questions[index - 1]?.groupId ? draft.groups.find((g) => g.id === q.groupId) : undefined
            const isEditing = editing === index
            return (
              <div key={index}>
                {showSection && <h3 className="mb-2 mt-7 text-[13px] font-semibold tracking-wide text-muted first:mt-0">{q.section}</h3>}
                {group && <GroupCard group={group} onChange={(stem) => setGroupStem(group.id, stem)} />}
                <section
                  ref={(el) => {
                    if (el) cards.current.set(index, el)
                    else cards.current.delete(index)
                  }}
                  onClick={() => !isEditing && select(index, false)}
                  onDoubleClick={() => !isEditing && setEditing(index)}
                  className={`relative scroll-mt-40 rounded-2xl bg-surface p-5 shadow-sheet transition-shadow ${selected === index ? 'ring-2 ring-accent/70' : ''}`}
                >
                  {isFlagged(q) && <span aria-hidden className="absolute bottom-5 left-0 top-5 w-[3px] rounded-r-full bg-amber-400" />}
                  {isEditing ? <QuestionEditor value={q} onChange={(v) => updateQuestion(index, v)} importId={importId} /> : <QuestionView q={q} />}
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-1 border-t border-line/70 pt-3">
                    <Button variant="ghost" className="px-2" onClick={() => moveQuestion(index, -1)} disabled={index === 0} aria-label="上移" title="上移">
                      <IconArrowUp size={16} />
                    </Button>
                    <Button variant="ghost" className="px-2" onClick={() => moveQuestion(index, 1)} disabled={index === draft.questions.length - 1} aria-label="下移" title="下移">
                      <IconArrowDown size={16} />
                    </Button>
                    <Button variant="danger" className="px-2" onClick={() => removeQuestion(index)} aria-label="刪除" title="刪除">
                      <IconTrash size={16} />
                    </Button>
                    <Button variant={isEditing ? 'primary' : 'secondary'} onClick={() => setEditing(isEditing ? null : index)} icon={isEditing ? <IconCheck size={16} /> : <IconEdit size={15} />}>
                      {isEditing ? '完成' : '編輯'}
                    </Button>
                  </div>
                </section>
              </div>
            )
          })}

          <Button onClick={addQuestion} className="w-full border border-dashed border-ink/15 bg-transparent py-3 shadow-none" icon={<IconPlus size={16} />}>
            新增題目
          </Button>
        </div>
      </div>

      <Fab actions={fabActions} badge={flagged || undefined} />
    </div>
  )
}

const SAVE_LABELS: Record<SaveState, string> = { saved: '草稿已自動儲存', saving: '儲存中…', dirty: '有未儲存的修改' }

/** Short plain-text preview of a question stem for the outline. */
function preview(stem: string) {
  return stem
    .replace(/\$\$?[^$]*\$\$?/g, '…')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/[#*_`>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Left column on wide screens: the exam's details and every question with its review state. */
function Outline({
  questions,
  selected,
  flaggedOnly,
  isFlagged,
  onSelect,
  onAdd,
  meta,
}: {
  questions: DraftQuestion[]
  selected: number | null
  flaggedOnly: boolean
  isFlagged: (q: DraftQuestion) => boolean
  onSelect: (index: number) => void
  onAdd: () => void
  meta: React.ReactNode
}) {
  return (
    <nav aria-label="題目大綱" className="hidden space-y-6 self-start min-[90rem]:sticky min-[90rem]:top-[calc(var(--bar)+1.25rem)] min-[90rem]:block min-[90rem]:max-h-[calc(100vh-var(--bar)-2.5rem)] min-[90rem]:overflow-y-auto min-[90rem]:pb-4">
      <section>
        <p className="mb-2 px-1 text-[11px] font-semibold tracking-[0.12em] text-muted">考卷資訊</p>
        <div className="space-y-2.5 rounded-2xl bg-surface p-3 shadow-sheet">{meta}</div>
      </section>
      <section>
        <p className="mb-2 flex items-center justify-between px-1 text-[11px] font-semibold tracking-[0.12em] text-muted">
          題目 <span className="num tracking-normal">{questions.length}</span>
        </p>
        <ol className="space-y-px">
          {questions.map((q, index) => {
            if (flaggedOnly && !isFlagged(q)) return null
            const on = selected === index
            const section = q.section && q.section !== questions[index - 1]?.section ? q.section : null
            return (
              <li key={index}>
                {section && <p className="mb-1 mt-3 truncate px-2 text-[11px] text-muted/80 first:mt-0">{section}</p>}
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  className={`m-press flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] ${
                    on ? 'bg-surface text-ink shadow-sheet' : 'text-muted hover:bg-ink/[0.04] hover:text-ink'
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
              </li>
            )
          })}
        </ol>
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
        <textarea value={group.stem} onChange={(e) => onChange(e.target.value)} rows={Math.min(16, group.stem.split('\n').length + 2)} className={`${inputClass} font-mono text-[13px]`} />
      ) : (
        <Markdown>{group.stem}</Markdown>
      )}
      {group.figures.map((f, i) => (
        <FigureView key={i} figure={f} />
      ))}
    </div>
  )
}
