'use client'

import { QuestionType, type Answer, type DraftQuestion } from '@exam/core'
import { useState, type ReactNode } from 'react'
import { FigureView } from '@/shared/FigureView'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { FigureBlanksEditor } from './FigureBlanksEditor'
import { IconAlert, IconChevronDown, IconPlus, IconX } from '@/shared/icons'
import { TYPE_LABELS } from '@/shared/labels'
import { Markdown } from '@/shared/Markdown'
import { MathTextInput } from '@/shared/math/MathTextInput'

const TYPES = QuestionType.options

const SOURCES: [Answer['source'], string][] = [
  ['printed', msg('印刷')],
  ['handwritten', msg('手寫')],
  ['none', msg('無')],
]

/** The quiet filled look of the small fields in the header line. */
const chip = 'h-9 rounded-lg bg-ink/[0.045] text-sm outline-none transition-shadow hover:bg-ink/[0.07] focus:bg-surface focus:ring-2 focus:ring-accent/40'
const iconButton = 'm-press grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-ink/[0.06] hover:text-ink'

/**
 * Editable form for one question. Controlled: the caller owns the value.
 * Number, type and points share one line with the caller's `actions`; every text is a box with its
 * name inside, so the form stays compact. importId is the upload the question came from, used to crop its figures again.
 */
export function QuestionEditor({
  value: q,
  onChange,
  importId = null,
  actions,
}: {
  value: DraftQuestion
  onChange: (q: DraftQuestion) => void
  importId?: string | null
  actions?: ReactNode
}) {
  const t = useT()
  const set = <K extends keyof DraftQuestion>(key: K, v: DraftQuestion[K]) => onChange({ ...q, [key]: v })
  const setAnswer = (patch: Partial<Answer>) => set('answer', { ...q.answer, ...patch })
  const hasChoices = q.options.length > 0 || q.type === 'single_choice' || q.type === 'multiple_choice'
  // Translation and explanation take room only once they have something in them, or are asked for.
  const [extra, setExtra] = useState({ translation: false, explanation: false })
  const showTranslation = extra.translation || Boolean(q.translation)
  const showExplanation = extra.explanation || Boolean(q.explanation)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
        <input
          autoComplete="off"
          value={q.number}
          onChange={(e) => set('number', e.target.value)}
          className={`${chip} num w-12 px-1.5 text-center text-base font-medium sm:w-14`}
          aria-label={t('題號')}
          title={t('題號')}
        />
        <label className="relative">
          <select value={q.type} onChange={(e) => set('type', e.target.value as DraftQuestion['type'])} className={`${chip} cursor-pointer appearance-none pl-3 pr-8`} aria-label={t('題型')} title={t('題型')}>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(TYPE_LABELS[type])}
              </option>
            ))}
          </select>
          <IconChevronDown size={15} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
        </label>
        <label className={`${chip} flex cursor-text items-center gap-1 pl-1 pr-2.5 focus-within:bg-surface focus-within:ring-2 focus-within:ring-accent/40`} title={t('配分')}>
          <input
            autoComplete="off"
            type="number"
            min={0}
            step="any"
            value={q.points ?? ''}
            onChange={(e) => set('points', e.target.value === '' ? null : Number(e.target.value))}
            placeholder="–"
            className="num w-8 bg-transparent text-right outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            aria-label={t('配分')}
          />
          <span className="text-muted">{t('分')}</span>
        </label>
        {actions && <div className="ml-auto flex items-center gap-0.5">{actions}</div>}
      </div>

      <MathTextInput label={t('題幹')} value={q.stem} onChange={(v) => set('stem', v)} />

      {q.figures.map((f, i) => (
        <div key={i} className="rounded-xl border border-line p-2">
          <FigureView figure={f} />
          <MathTextInput
            multiline={false}
            prefix={<span className="pl-1.5 text-[11px] font-medium text-muted">{t('說明')}</span>}
            placeholder={t('圖片說明')}
            value={f.description}
            onChange={(v) => set('figures', q.figures.map((g, j) => (j === i ? { ...g, description: v } : g)))}
            className="mt-2"
          />
          {f.blanks.length ? (
            <div className="px-1">
              <FigureBlanksEditor figure={f} importId={importId} onChange={(g) => set('figures', q.figures.map((x, j) => (j === i ? g : x)))} />
            </div>
          ) : null}
        </div>
      ))}

      {hasChoices && <OptionsEditor q={q} onChange={onChange} />}

      <AnswerEditor q={q} setAnswer={setAnswer} />

      {showTranslation && (
        <MathTextInput
          label={t('翻譯')}
          value={q.translation ?? ''}
          onChange={(v) => set('translation', v || null)}
          actions={<RemoveButton label={t('移除翻譯')} onClick={() => (set('translation', null), setExtra({ ...extra, translation: false }))} />}
        />
      )}
      {showExplanation && (
        <MathTextInput
          label={t('詳解')}
          value={q.explanation ?? ''}
          onChange={(v) => set('explanation', v || null)}
          actions={<RemoveButton label={t('移除詳解')} onClick={() => (set('explanation', null), setExtra({ ...extra, explanation: false }))} />}
        />
      )}
      {(!showTranslation || !showExplanation) && (
        <div className="flex flex-wrap gap-1.5">
          {!showTranslation && <AddChip onClick={() => setExtra({ ...extra, translation: true })}>{t('翻譯')}</AddChip>}
          {!showExplanation && <AddChip onClick={() => setExtra({ ...extra, explanation: true })}>{t('詳解')}</AddChip>}
        </div>
      )}

      {q.issues.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl bg-warn-soft px-3 py-2.5 text-sm">
          <span className="flex h-[1.625em] shrink-0 items-center">
            <IconAlert size={16} className="text-warn" aria-label={t('待檢查')} />
          </span>
          <ul className="min-w-0 flex-1 space-y-1 leading-relaxed text-ink/80">
            {q.issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2">
                <Markdown className="min-w-0 flex-1">{t(issue)}</Markdown>
                <button
                  type="button"
                  onClick={() => set('issues', q.issues.filter((_, j) => j !== i))}
                  className="m-press -my-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md text-warn/70 hover:bg-surface hover:text-ink"
                  aria-label={t('移除這個提示')}
                  title={t('已確認：移除這個提示')}
                >
                  <IconX size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/** A section title with its controls on the same line. */
function SectionHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-1.5 flex h-7 items-center gap-2">
      <span className="text-[11px] font-medium tracking-wide text-muted">{title}</span>
      {children && <div className="ml-auto flex items-center gap-1">{children}</div>}
    </div>
  )
}

function AddChip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="m-press flex h-7 items-center gap-1 rounded-full border border-dashed border-ink/15 px-2.5 text-xs text-muted hover:border-accent/50 hover:bg-accent-soft hover:text-accent"
    >
      <IconPlus size={13} strokeWidth={2.4} />
      {children}
    </button>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${iconButton} h-6 w-6 hover:bg-bad-soft hover:text-bad`} aria-label={label} title={label}>
      <IconX size={14} />
    </button>
  )
}

function OptionsEditor({ q, onChange }: { q: DraftQuestion; onChange: (q: DraftQuestion) => void }) {
  const t = useT()
  const setOptions = (options: DraftQuestion['options']) => onChange({ ...q, options })
  const nextLabel = () => {
    const last = q.options.at(-1)?.label
    if (last && /^[A-Y]$/.test(last)) return String.fromCharCode(last.charCodeAt(0) + 1)
    if (last && /^\d+$/.test(last)) return String(Number(last) + 1)
    return 'A'
  }
  return (
    <div>
      <SectionHead title={t('選項')}>
        <button type="button" onClick={() => setOptions([...q.options, { label: nextLabel(), content: '' }])} className="m-press flex h-7 items-center gap-1 rounded-md px-2 text-xs text-accent hover:bg-accent-soft">
          <IconPlus size={13} strokeWidth={2.4} />
          {t('新增')}
        </button>
      </SectionHead>
      <div className="grid gap-1.5">
        {q.options.map((o, i) => (
          <MathTextInput
            key={i}
            value={o.content}
            onChange={(v) => setOptions(q.options.map((p, j) => (j === i ? { ...p, content: v } : p)))}
            multiline={false}
            placeholder={t('選項內容')}
            prefix={
              <input
                autoComplete="off"
                value={o.label}
                onChange={(e) => setOptions(q.options.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)))}
                className="num h-7 w-9 rounded-md bg-ink/[0.045] text-center text-[13px] font-semibold text-muted outline-none focus:bg-accent-soft focus:text-accent"
                aria-label={t('選項代號')}
                title={t('選項代號')}
              />
            }
            actions={<RemoveButton label={t('刪除選項 {label}', { label: o.label })} onClick={() => setOptions(q.options.filter((_, j) => j !== i))} />}
          />
        ))}
      </div>
    </div>
  )
}

function AnswerEditor({ q, setAnswer }: { q: DraftQuestion; setAnswer: (patch: Partial<Answer>) => void }) {
  const t = useT()
  const blanks = q.figures.flatMap((f) => f.image?.blanks ?? f.blanks)
  const toggle = (label: string) => {
    const single = q.type === 'single_choice'
    const has = q.answer.values.includes(label)
    const values = single ? (has ? [] : [label]) : has ? q.answer.values.filter((v) => v !== label) : [...q.answer.values, label]
    setAnswer({ values: q.options.map((o) => o.label).filter((l) => values.includes(l)) })
  }
  const pick = (on: boolean) =>
    `m-press h-9 min-w-10 rounded-lg px-3 text-sm font-medium ${on ? 'bg-accent text-on-accent shadow-[0_6px_16px_-8px_var(--color-accent)]' : 'bg-ink/[0.045] text-ink/80 hover:bg-ink/[0.08]'}`

  let body: ReactNode
  let more: ReactNode = null
  if (q.type === 'true_false') {
    body = (
      <div className="flex gap-1.5">
        {[
          ['true', t('○ 是')],
          ['false', t('╳ 非')],
        ].map(([v, text]) => (
          <button key={v} type="button" className={pick(q.answer.values[0] === v)} aria-pressed={q.answer.values[0] === v} onClick={() => setAnswer({ values: q.answer.values[0] === v ? [] : [v!] })}>
            {text}
          </button>
        ))}
      </div>
    )
  } else if ((q.type === 'single_choice' || q.type === 'multiple_choice') && q.options.length) {
    body = (
      <div className="flex flex-wrap gap-1.5">
        {q.options.map((o, i) => (
          <button key={`${o.label}-${i}`} type="button" className={`${pick(q.answer.values.includes(o.label))} num`} aria-pressed={q.answer.values.includes(o.label)} onClick={() => toggle(o.label)}>
            {o.label}
          </button>
        ))}
      </div>
    )
  } else if (blanks.length) {
    body = (
      <div className="grid gap-1.5 sm:grid-cols-2">
        {blanks.map((b, i) => (
          <MathTextInput
            key={i}
            value={q.answer.values[i] ?? ''}
            onChange={(v) => setAnswer({ values: blanks.map((_, j) => (j === i ? v : (q.answer.values[j] ?? ''))) })}
            multiline={false}
            prefix={<span className="num min-w-7 pl-1 text-[13px] font-semibold text-muted">({b.label})</span>}
          />
        ))}
      </div>
    )
  } else {
    // One box per answer (a question with several blanks or parts has several).
    const values = q.answer.values.length ? q.answer.values : ['']
    const setAt = (i: number, v: string) => setAnswer({ values: values.map((x, j) => (j === i ? v : x)).filter((x, j, all) => x.trim() || all.length > 1) })
    const long = q.type === 'essay' || q.type === 'calculation' || q.type === 'short_answer'
    body = (
      <div className="grid gap-1.5">
        {values.map((v, i) => (
          <MathTextInput
            key={i}
            value={v}
            onChange={(x) => setAt(i, x)}
            multiline={long}
            label={long && values.length > 1 ? t('答案 {n}', { n: i + 1 }) : undefined}
            prefix={!long && values.length > 1 ? <span className="num min-w-6 pl-1 text-[13px] font-semibold text-muted">{i + 1}.</span> : undefined}
            placeholder={t('沒有答案可以留空')}
            actions={values.length > 1 ? <RemoveButton label={t('刪除第 {n} 個答案', { n: i + 1 })} onClick={() => setAnswer({ values: values.filter((_, j) => j !== i) })} /> : undefined}
          />
        ))}
      </div>
    )
    more = (
      <button type="button" onClick={() => setAnswer({ values: [...values, ''] })} className="m-press flex h-7 items-center gap-1 rounded-md px-2 text-xs text-accent hover:bg-accent-soft" title={t('題目有幾個空格或小題，就加幾格答案')}>
        <IconPlus size={13} strokeWidth={2.4} />
        {t('加一格')}
      </button>
    )
  }

  return (
    <div>
      <SectionHead title={t('答案')}>
        {more}
        <div className="flex rounded-lg bg-ink/[0.045] p-0.5" role="group" aria-label={t('答案來源')} title={t('答案來源：卷上印的、手寫的，或沒有')}>
          {SOURCES.map(([v, text]) => (
            <button
              key={v}
              type="button"
              onClick={() => setAnswer({ source: v })}
              aria-pressed={q.answer.source === v}
              className={`m-press h-6 rounded-md px-2 text-[11px] font-medium ${q.answer.source === v ? 'bg-surface text-ink shadow-sheet' : 'text-muted hover:text-ink'}`}
            >
              {t(text)}
            </button>
          ))}
        </div>
      </SectionHead>
      {body}
    </div>
  )
}
