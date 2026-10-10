'use client'

import { isPickAnswer, matchingItemCount, type Answer, type DraftQuestion } from '@exam/core'
import type { ReactNode } from 'react'
import { IconPlus } from '@/shared/icons'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { MathTextInput } from '@/shared/math/MathTextInput'
import { RemoveButton, SectionHead } from './editorParts'

const SOURCES: [Answer['source'], string][] = [
  ['printed', msg('印刷')],
  ['handwritten', msg('手寫')],
  ['ai', msg('AI 解答')],
  ['none', msg('無')],
]

export function AnswerEditor({ q, setAnswer, extra }: { q: DraftQuestion; setAnswer: (patch: Partial<Answer>) => void; extra?: React.ReactNode }) {
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
  } else if (q.type === 'writing') {
    // The characters to practise; each one becomes a row of the practice grid.
    body = (
      <MathTextInput
        value={q.answer.values.join(' ')}
        // kept as typed (spaces too), so typing is never interrupted; spaces are skipped in the grid
        onChange={(v) => setAnswer({ values: v.trim() ? [v] : [] })}
        multiline={false}
        placeholder={t('要練習的字，例如：永 春天')}
      />
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
  } else if (isPickAnswer(q) && !blanks.length) {
    // 配合題 or blanks filled from a list: one row per item, each one option label.
    const count = matchingItemCount(q)
    const values = Array.from({ length: count }, (_, i) => q.answer.values[i] ?? '')
    const setAt = (i: number, label: string) => setAnswer({ values: values.map((v, j) => (j === i ? label : v)) })
    body = (
      <div className="grid gap-1.5">
        {values.map((v, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="num min-w-7 text-[13px] font-semibold text-muted">({i + 1})</span>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {q.options.map((o, k) => (
                <button key={`${o.label}-${k}`} type="button" className={`${pick(v === o.label)} num`} aria-pressed={v === o.label} onClick={() => setAt(i, v === o.label ? '' : o.label)}>
                  {o.label}
                </button>
              ))}
            </div>
            {count > 1 && <RemoveButton label={t('刪除第 {n} 個答案', { n: i + 1 })} onClick={() => setAnswer({ values: values.filter((_, j) => j !== i) })} />}
          </div>
        ))}
      </div>
    )
    more = (
      <button type="button" onClick={() => setAnswer({ values: [...values, ''] })} className="m-press flex h-7 items-center gap-1 rounded-md px-2 text-xs text-accent hover:bg-accent-soft">
        <IconPlus size={13} strokeWidth={2.4} />
        {t('加一項')}
      </button>
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
    const long = q.type === 'essay' || q.type === 'composition' || q.type === 'calculation' || q.type === 'short_answer'
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
        {extra}
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
      {q.type === 'fill_in_blank' && !isPickAnswer(q) && <p className="mt-1 px-1 text-[11px] text-muted">{t('數字答案可以寫範圍，例如 98 ± 2 或 96 ~ 100，範圍內都算對。')}</p>}
    </div>
  )
}
