'use client'

import { QuestionType, type Answer, type DraftQuestion } from '@exam/core'
import { useState, type ReactNode } from 'react'
import { FigureView } from '@/shared/FigureView'
import { useT } from '@/shared/i18n/client'
import { FigureBlanksEditor } from './FigureBlanksEditor'
import { IconAlert, IconChevronDown, IconX } from '@/shared/icons'
import { TYPE_LABELS } from '@/shared/labels'
import { Markdown } from '@/shared/Markdown'
import { MathTextInput } from '@/shared/math/MathTextInput'
import { AnswerEditor } from './AnswerEditor'
import { AddChip, chip, RemoveButton } from './editorParts'
import { OptionsEditor } from './OptionsEditor'

const TYPES = QuestionType.options


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
