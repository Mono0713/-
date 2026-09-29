'use client'

import { QuestionType, type Answer, type DraftQuestion } from '@exam/core'
import { FigureView } from '@/shared/FigureView'
import { FigureBlanksEditor } from './FigureBlanksEditor'
import { TYPE_LABELS } from '@/shared/labels'
import { Markdown } from '@/shared/Markdown'
import { MathTextInput } from '@/shared/math/MathTextInput'
import { Button, inputBase, inputClass } from '@/shared/ui'

const TYPES = QuestionType.options

/**
 * Editable form for one question. Controlled: the caller owns the value.
 * importId is the upload the question came from, used to crop its figures again.
 */
export function QuestionEditor({ value: q, onChange, importId = null }: { value: DraftQuestion; onChange: (q: DraftQuestion) => void; importId?: string | null }) {
  const set = <K extends keyof DraftQuestion>(key: K, v: DraftQuestion[K]) => onChange({ ...q, [key]: v })
  const setAnswer = (patch: Partial<Answer>) => set('answer', { ...q.answer, ...patch })
  const hasChoices = q.options.length > 0 || q.type === 'single_choice' || q.type === 'multiple_choice'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[5rem_minmax(0,1fr)_6rem] gap-3">
        <Field label="題號">
          <input value={q.number} onChange={(e) => set('number', e.target.value)} className={inputClass} />
        </Field>
        <Field label="題型">
          <select value={q.type} onChange={(e) => set('type', e.target.value as DraftQuestion['type'])} className={inputClass}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="配分">
          <input
            type="number"
            min={0}
            step="any"
            value={q.points ?? ''}
            onChange={(e) => set('points', e.target.value === '' ? null : Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>

      <MathTextInput label="題幹" value={q.stem} onChange={(v) => set('stem', v)} />

      {q.figures.map((f, i) => (
        <div key={i} className="rounded-lg border border-line p-3">
          <FigureView figure={f} />
          <MathTextInput
            multiline={false}
            label="圖片說明"
            value={f.description}
            onChange={(v) => set('figures', q.figures.map((g, j) => (j === i ? { ...g, description: v } : g)))}
            className="mt-2"
          />
          {f.blanks.length ? (
            <FigureBlanksEditor figure={f} importId={importId} onChange={(g) => set('figures', q.figures.map((x, j) => (j === i ? g : x)))} />
          ) : null}
        </div>
      ))}

      {hasChoices && <OptionsEditor q={q} onChange={onChange} />}

      <AnswerEditor q={q} setAnswer={setAnswer} />

      <details className="group" open={Boolean(q.translation || q.explanation)}>
        <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">翻譯與詳解</summary>
        <div className="mt-3 space-y-4">
          <MathTextInput label="翻譯" value={q.translation ?? ''} onChange={(v) => set('translation', v || null)} />
          <MathTextInput label="詳解" value={q.explanation ?? ''} onChange={(v) => set('explanation', v || null)} />
        </div>
      </details>

      {q.issues.length > 0 && (
        <div className="rounded-lg bg-warn-soft p-3 text-sm">
          <p className="mb-1 font-medium text-warn">待檢查（確認後可移除）</p>
          <ul className="space-y-1">
            {q.issues.map((issue, i) => (
              <li key={i} className="flex items-start justify-between gap-3">
                <Markdown className="min-w-0 flex-1">{issue}</Markdown>
                <button type="button" onClick={() => set('issues', q.issues.filter((_, j) => j !== i))} className="shrink-0 text-xs text-muted hover:text-ink">
                  移除
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}

function OptionsEditor({ q, onChange }: { q: DraftQuestion; onChange: (q: DraftQuestion) => void }) {
  const setOptions = (options: DraftQuestion['options']) => onChange({ ...q, options })
  const nextLabel = () => {
    const last = q.options.at(-1)?.label
    if (last && /^[A-Y]$/.test(last)) return String.fromCharCode(last.charCodeAt(0) + 1)
    if (last && /^\d+$/.test(last)) return String(Number(last) + 1)
    return 'A'
  }
  return (
    <div className="text-sm">
      <span className="mb-1 block text-xs font-medium text-muted">選項</span>
      <div className="space-y-2">
        {q.options.map((o, i) => (
          <div key={i} className="flex items-start gap-2">
            <input
              value={o.label}
              onChange={(e) => setOptions(q.options.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)))}
              className={`${inputBase} w-14 shrink-0 text-center`}
              aria-label="選項代號"
            />
            <MathTextInput
              value={o.content}
              onChange={(v) => setOptions(q.options.map((p, j) => (j === i ? { ...p, content: v } : p)))}
              multiline={false}
              className="min-w-0 flex-1"
            />
            <Button variant="ghost" className="shrink-0 px-2 text-muted" onClick={() => setOptions(q.options.filter((_, j) => j !== i))} aria-label={`刪除選項 ${o.label}`} title="刪除選項">
              ✕
            </Button>
          </div>
        ))}
      </div>
      <Button variant="ghost" className="mt-1" onClick={() => setOptions([...q.options, { label: nextLabel(), content: '' }])}>
        ＋ 新增選項
      </Button>
    </div>
  )
}

function AnswerEditor({ q, setAnswer }: { q: DraftQuestion; setAnswer: (patch: Partial<Answer>) => void }) {
  const blanks = q.figures.flatMap((f) => f.image?.blanks ?? f.blanks)
  const toggle = (label: string) => {
    const single = q.type === 'single_choice'
    const has = q.answer.values.includes(label)
    const values = single ? (has ? [] : [label]) : has ? q.answer.values.filter((v) => v !== label) : [...q.answer.values, label]
    setAnswer({ values: q.options.map((o) => o.label).filter((l) => values.includes(l)) })
  }

  let body: React.ReactNode
  if (q.type === 'true_false') {
    body = (
      <div className="flex gap-2">
        {[
          ['true', '○ 是'],
          ['false', '╳ 非'],
        ].map(([v, text]) => (
          <Button key={v} variant={q.answer.values[0] === v ? 'primary' : 'secondary'} onClick={() => setAnswer({ values: q.answer.values[0] === v ? [] : [v!] })}>
            {text}
          </Button>
        ))}
      </div>
    )
  } else if ((q.type === 'single_choice' || q.type === 'multiple_choice') && q.options.length) {
    body = (
      <div className="flex flex-wrap gap-2">
        {q.options.map((o, i) => (
          <Button key={`${o.label}-${i}`} variant={q.answer.values.includes(o.label) ? 'primary' : 'secondary'} onClick={() => toggle(o.label)} className="min-w-10">
            {o.label}
          </Button>
        ))}
      </div>
    )
  } else if (blanks.length) {
    body = (
      <div className="grid gap-2 sm:grid-cols-2">
        {blanks.map((b, i) => (
          <label key={i} className="flex items-center gap-2">
            <span className="w-10 shrink-0 text-right text-xs text-muted">({b.label})</span>
            <MathTextInput
              value={q.answer.values[i] ?? ''}
              onChange={(v) => setAnswer({ values: blanks.map((_, j) => (j === i ? v : (q.answer.values[j] ?? ''))) })}
              multiline={false}
              className="min-w-0 flex-1"
            />
          </label>
        ))}
      </div>
    )
  } else {
    // One box per answer (a question with several blanks or parts has several).
    const values = q.answer.values.length ? q.answer.values : ['']
    const setAt = (i: number, v: string) => setAnswer({ values: values.map((x, j) => (j === i ? v : x)).filter((x, j, all) => x.trim() || all.length > 1) })
    body = (
      <div className="space-y-2">
        {values.map((v, i) => (
          <div key={i} className="flex items-start gap-2">
            {values.length > 1 && <span className="w-6 shrink-0 pt-2 text-right text-xs text-muted">{i + 1}.</span>}
            <MathTextInput value={v} onChange={(x) => setAt(i, x)} multiline={q.type === 'essay' || q.type === 'calculation' || q.type === 'short_answer'} className="min-w-0 flex-1" placeholder="沒有答案可以留空" />
            {values.length > 1 && (
              <Button variant="ghost" className="shrink-0 px-2 text-muted" onClick={() => setAnswer({ values: values.filter((_, j) => j !== i) })} aria-label={`刪除第 ${i + 1} 個答案`}>
                ✕
              </Button>
            )}
          </div>
        ))}
        <Button variant="ghost" onClick={() => setAnswer({ values: [...values, ''] })}>
          ＋ 再加一格答案
        </Button>
      </div>
    )
  }

  return (
    <div className="text-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted">答案</span>
        <select value={q.answer.source} onChange={(e) => setAnswer({ source: e.target.value as Answer['source'] })} className="rounded border border-line bg-surface px-1.5 py-0.5 text-xs" aria-label="答案來源">
          <option value="printed">印刷</option>
          <option value="handwritten">手寫</option>
          <option value="none">無</option>
        </select>
      </div>
      {body}
    </div>
  )
}
