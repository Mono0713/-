'use client'

import type { DraftExam, DraftQuestion } from '@exam/core'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { QuestionEditor } from '@/features/questions/QuestionEditor'
import { QuestionView } from '@/features/questions/QuestionView'
import { FigureView } from '@/shared/FigureView'
import { Markdown } from '@/shared/Markdown'
import { Button, Card, inputClass } from '@/shared/ui'
import { publishDraft, saveDraft } from './actions'
import { PageViewer } from './PageViewer'

type SaveState = 'saved' | 'dirty' | 'saving'

/**
 * Side-by-side review: source page on the left, extracted questions on the right.
 * Every edit is saved as a draft automatically; "存入題庫" puts the questions in the bank.
 */
export function ReviewEditor({
  importId,
  initial,
  pages,
  savedExam,
  notice,
}: {
  importId: string
  initial: DraftExam
  pages: { pageNumber: number; image: string }[]
  /** The exam this import was already saved as. */
  savedExam: { id: string; questionCount: number } | null
  notice?: React.ReactNode
}) {
  const [draft, setDraft] = useState(initial)
  const [selected, setSelected] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(pages[0]?.pageNumber ?? 1)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [published, setPublished] = useState(savedExam ? { count: savedExam.questionCount, examId: savedExam.id } : null)
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [publishing, startPublish] = useTransition()
  const cards = useRef(new Map<number, HTMLElement>())
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
    if (scroll) cards.current.get(index)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

  return (
    <div>
      <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-semibold">{draft.questions.length} 題</span>
              {flagged > 0 && <span className="text-warn"> · {flagged} 題待確認</span>}
              <span className="text-muted"> · {saveState === 'saved' ? '草稿已自動儲存' : saveState === 'saving' ? '儲存中…' : '有未儲存的修改'}</span>
            </p>
          </div>
          {flagged > 0 && (
            <label className="flex items-center gap-1.5 text-sm text-muted">
              <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} className="accent-accent" />
              只看待確認
            </label>
          )}
          {published !== null && (
            <Link href={`/bank/exams/${published.examId}`} className="text-sm text-good hover:underline">
              已存入題庫 {published.count} 題 →
            </Link>
          )}
          <Button variant="primary" onClick={publish} disabled={publishing || !draft.questions.length}>
            {publishing ? '存入中…' : published !== null ? '更新題庫' : '存入題庫'}
          </Button>
        </div>
        <nav className="-mx-1 mt-2 flex gap-1 overflow-x-auto px-1 pb-1" aria-label="題號">
          {draft.questions.map((q, index) =>
            flaggedOnly && !isFlagged(q) ? null : (
              <button
                key={index}
                type="button"
                onClick={() => select(index, true)}
                title={isFlagged(q) ? '待確認' : undefined}
                className={`h-7 min-w-8 shrink-0 rounded-md border px-1.5 text-xs tabular-nums transition-colors ${
                  selected === index
                    ? 'border-accent bg-accent text-white'
                    : isFlagged(q)
                      ? 'border-warn/40 bg-warn-soft text-warn hover:border-warn'
                      : 'border-line bg-surface text-muted hover:border-accent/50 hover:text-ink'
                }`}
              >
                {q.number}
              </button>
            ),
          )}
        </nav>
      </div>

      {notice}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <aside className="lg:sticky lg:top-36 lg:max-h-[calc(100vh-10rem)] lg:self-start lg:overflow-auto">
          <PageViewer pages={pages} pageNumber={pageNumber} onPageChange={setPageNumber} questions={draft.questions} selected={selected} onSelect={(i) => select(i, true)} />
        </aside>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['title', '考卷名稱'],
                  ['subject', '科目'],
                  ['institution', '學校'],
                  ['term', '學期'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
                  <input value={meta[key] ?? ''} onChange={(e) => setMeta(key, e.target.value)} className={inputClass} />
                </label>
              ))}
            </div>
          </Card>

          {draft.questions.map((q, index) => {
            if (flaggedOnly && !isFlagged(q)) return null
            const showSection = q.section && q.section !== draft.questions[index - 1]?.section
            const group = q.groupId && q.groupId !== draft.questions[index - 1]?.groupId ? draft.groups.find((g) => g.id === q.groupId) : undefined
            const isEditing = editing === index
            return (
              <div key={index}>
                {showSection && <h3 className="mb-2 mt-6 text-sm font-semibold text-muted">{q.section}</h3>}
                {group && <GroupCard group={group} onChange={(stem) => setGroupStem(group.id, stem)} />}
                <section
                  ref={(el) => {
                    if (el) cards.current.set(index, el)
                    else cards.current.delete(index)
                  }}
                  onClick={() => !isEditing && select(index, false)}
                  onDoubleClick={() => !isEditing && setEditing(index)}
                  className={`rounded-xl border bg-surface p-4 transition-shadow ${selected === index ? 'border-accent shadow-[0_0_0_3px] shadow-accent/15' : 'border-line'} ${
                    isFlagged(q) ? 'border-l-4 border-l-warn' : ''
                  }`}
                >
                  {isEditing ? <QuestionEditor value={q} onChange={(v) => updateQuestion(index, v)} importId={importId} /> : <QuestionView q={q} />}
                  <div className="mt-3 flex flex-wrap justify-end gap-1 border-t border-line pt-3">
                    <Button variant="ghost" onClick={() => moveQuestion(index, -1)} disabled={index === 0} aria-label="上移">
                      ↑
                    </Button>
                    <Button variant="ghost" onClick={() => moveQuestion(index, 1)} disabled={index === draft.questions.length - 1} aria-label="下移">
                      ↓
                    </Button>
                    <Button variant="danger" onClick={() => removeQuestion(index)}>
                      刪除
                    </Button>
                    <Button variant={isEditing ? 'primary' : 'secondary'} onClick={() => setEditing(isEditing ? null : index)}>
                      {isEditing ? '完成' : '編輯'}
                    </Button>
                  </div>
                </section>
              </div>
            )
          })}

          <Button onClick={addQuestion} className="w-full">
            ＋ 新增題目
          </Button>
        </div>
      </div>
    </div>
  )
}

/** A passage or figure shared by the questions after it; its text can be edited in place. */
function GroupCard({ group, onChange }: { group: DraftExam['groups'][number]; onChange: (stem: string) => void }) {
  const [editing, setEditing] = useState(false)
  return (
    <div className="mb-3 rounded-xl border border-line bg-paper p-4">
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
