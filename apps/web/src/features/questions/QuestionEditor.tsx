'use client'

import { QuestionType, type Answer, type DraftQuestion } from '@exam/core'
import { Fragment, useState, type ReactNode } from 'react'
import { useT } from '@/shared/i18n/client'
import { FiguresEditor } from './FiguresEditor'
import { IconAlert, IconChevronDown, IconX } from '@/shared/icons'
import { TYPE_LABELS, WORD_BANK_LABEL } from '@/shared/labels'
import { Markdown } from '@/shared/Markdown'
import { MathTextInput } from '@/shared/math/MathTextInput'
import { AnswerEditor } from './AnswerEditor'
import { AddChip, AiButton, chip, RemoveButton, SectionHead, type QuestionAi } from './editorParts'
import { WordBox } from '@/shared/WordBox'
import { OptionsEditor } from './OptionsEditor'
import { useFigureTools, type FrameFigure } from './useFigureTools'

export type { FrameArea, FrameFigure } from './useFigureTools'

const TYPES = QuestionType.options
/** Not a stored type: a fill-in under a group's word box. */
const WORD_BANK = 'word_bank'


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
  ai,
  frame,
  wordBank = false,
  onWordBank,
}: {
  value: DraftQuestion
  onChange: (q: DraftQuestion) => void
  importId?: string | null
  actions?: ReactNode
  /** AI 作答 / AI 詳解 for this question, where the page offers them. */
  ai?: QuestionAi
  /** Frames a picture on the original pages (review only). */
  frame?: FrameFigure
  /** A sentence of a word box (選詞填空): its options are the box, edited on the group card above. */
  wordBank?: boolean
  /** Offers 選詞填空 as a type: the question gets a word box the next sentences share. */
  onWordBank?: () => void
}) {
  const t = useT()
  const set = <K extends keyof DraftQuestion>(key: K, v: DraftQuestion[K]) => onChange({ ...q, [key]: v })
  const setAnswer = (patch: Partial<Answer>) => set('answer', { ...q.answer, ...patch })
  const hasChoices = q.options.length > 0 || q.type === 'single_choice' || q.type === 'multiple_choice'
  // Translation and explanation take room only once they have something in them, or are asked for.
  const [extra, setExtra] = useState({ translation: false, explanation: false, rule: false })
  const showTranslation = extra.translation || Boolean(q.translation)
  const showExplanation = extra.explanation || Boolean(q.explanation)
  const showRule = extra.rule || Boolean(q.markingRule)
  const hasKey = q.answer.values.some((v) => v.trim())
  const figures = useFigureTools({ q, onChange, importId, frame })

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
          <select
            value={wordBank ? WORD_BANK : q.type}
            onChange={(e) => {
              if (e.target.value === WORD_BANK) return onWordBank?.()
              // another type takes the sentence out of its word box
              onChange({ ...q, type: e.target.value as DraftQuestion['type'], ...(wordBank ? { groupId: null } : {}) })
            }}
            className={`${chip} cursor-pointer appearance-none pl-3 pr-8`} aria-label={t('題型')} title={t('題型')}>
            {TYPES.map((type) => (
              <Fragment key={type}>
                <option value={type}>{t(TYPE_LABELS[type])}</option>
                {type === 'fill_in_blank' && (wordBank || onWordBank) && <option value={WORD_BANK}>{t(WORD_BANK_LABEL)}</option>}
              </Fragment>
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
        {(q.type === 'short_answer' || q.type === 'essay' || q.type === 'composition') && (
          <label className={`${chip} flex cursor-text items-center gap-1 pl-2.5 pr-2.5 focus-within:bg-surface focus-within:ring-2 focus-within:ring-accent/40`} title={t('字數上限')}>
            <span className="text-muted">{t('限')}</span>
            <input
              autoComplete="off"
              type="number"
              min={1}
              step={1}
              value={q.maxLength ?? ''}
              onChange={(e) => set('maxLength', e.target.value === '' ? null : Math.max(1, Math.round(Number(e.target.value))))}
              placeholder="–"
              className="num w-9 bg-transparent text-right outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              aria-label={t('字數上限')}
            />
            <span className="text-muted">{t('字')}</span>
          </label>
        )}
        {actions && <div className="ml-auto flex items-center gap-0.5">{actions}</div>}
      </div>

      <MathTextInput label={t('題幹')} value={q.stem} onChange={(v) => set('stem', v)} />

      <FiguresEditor q={q} onChange={onChange} importId={importId} tools={figures} />
      {figures.input}

      {wordBank ? (
        // in review the box is right above, on the group card; elsewhere it is shown here
        onWordBank ? (
          <p className="text-xs text-muted">{t('在上方的題組卡按「編輯」修改字庫。')}</p>
        ) : (
          <div>
            <SectionHead title={t('字庫（每題共用）')} />
            <WordBox options={q.options} />
          </div>
        )
      ) : (
        hasChoices && <OptionsEditor q={q} onChange={onChange} tools={figures} />
      )}

      <AnswerEditor
        q={q}
        setAnswer={setAnswer}
        extra={ai && <AiButton label={ai.busy === 'answer' ? t('AI 作答中…') : t('AI 作答')} title={hasKey ? t('讓 AI 重新作答這一題（可以復原）') : t('讓 AI 作答這一題')} busy={ai.busy === 'answer'} onClick={ai.answer} />}
      />

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
          actions={
            <>
              {ai && hasKey && <AiButton label={ai.busy === 'explain' ? t('AI 撰寫中…') : t('AI 重寫')} title={t('讓 AI 重新寫這一題的詳解（可以復原）')} busy={ai.busy === 'explain'} onClick={ai.explain} />}
              <RemoveButton label={t('移除詳解')} onClick={() => (set('explanation', null), setExtra({ ...extra, explanation: false }))} />
            </>
          }
        />
      )}
      {showRule && (
        <MathTextInput
          label={t('評分規則')}
          multiline={false}
          placeholder={t('例如：一個錯字扣一分')}
          value={q.markingRule ?? ''}
          onChange={(v) => set('markingRule', v || null)}
          actions={<RemoveButton label={t('移除評分規則')} onClick={() => (set('markingRule', null), setExtra({ ...extra, rule: false }))} />}
        />
      )}
      {(!showTranslation || !showExplanation || !showRule) && (
        <div className="flex flex-wrap gap-1.5">
          {!showTranslation && <AddChip onClick={() => setExtra({ ...extra, translation: true })}>{t('翻譯')}</AddChip>}
          {!showExplanation && <AddChip onClick={() => setExtra({ ...extra, explanation: true })}>{t('詳解')}</AddChip>}
          {!showExplanation && ai && hasKey && <AiButton chip label={ai.busy === 'explain' ? t('AI 撰寫中…') : t('AI 詳解')} title={t('讓 AI 寫這一題的詳解')} busy={ai.busy === 'explain'} onClick={ai.explain} />}
          {!showRule && <AddChip onClick={() => setExtra({ ...extra, rule: true })}>{t('評分規則')}</AddChip>}
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
