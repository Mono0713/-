'use client'

import { optionFigures, questionFigures, type DraftQuestion } from '@exam/core'
import { FigureView, OptionPictures } from '@/shared/FigureView'
import { msg, type T } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { IconAlert } from '@/shared/icons'
import { ConfirmNote } from './ConfirmNote'
import { CONFIDENCE_LABELS, TYPE_LABELS } from '@/shared/labels'
import { Markdown } from '@/shared/Markdown'
import { splitNumber } from '@/shared/questionNumber'
import { Badge } from '@/shared/ui'

const SOURCE_LABELS = { printed: msg('印刷'), handwritten: msg('手寫'), none: '' } as const

/**
 * Read-only rendering of a question, used in review and in the bank. `actions` sit at the end of its header line.
 * With `onConfirm` (review), what needs checking shows as one note with a button that clears it.
 */
export function QuestionView({ q, compact = false, actions, onConfirm }: { q: DraftQuestion; compact?: boolean; actions?: React.ReactNode; onConfirm?: () => void }) {
  const t = useT()
  const blanks = questionFigures(q).flatMap((f) => f.image?.blanks ?? [])
  const answerByBlank = blanks.length > 0 && blanks.length === q.answer.values.length
  const isChoice = q.type === 'single_choice' || q.type === 'multiple_choice'
  let blankOffset = 0
  const flagged = q.confidence !== 'high' || q.issues.length > 0
  return (
    <div className="space-y-3">
      <QuestionHeading q={q} showConfidence={!onConfirm} actions={actions} />

      <Markdown>{q.stem}</Markdown>
      {q.translation && <Markdown className="border-l-2 border-line pl-3 text-sm text-muted">{q.translation}</Markdown>}
      {q.markingRule?.trim() && (
        <p className="text-xs text-muted">
          {t('評分規則：')}
          <span className="rounded bg-warn-soft px-1 text-ink/80">{q.markingRule.trim()}</span>
        </p>
      )}

      {questionFigures(q).map((f, i) => {
        const count = f.image?.blanks.length ?? 0
        const answers = answerByBlank ? q.answer.values.slice(blankOffset, blankOffset + count) : undefined
        blankOffset += count
        return <FigureView key={i} figure={f} answers={answers} />
      })}

      {q.options.length > 0 && (
        <ul className={`grid gap-1.5 ${compact ? '' : 'sm:grid-cols-2'}`}>
          {q.options.map((o, i) => {
            const correct = isChoice && q.answer.values.includes(o.label)
            return (
              <li key={`${o.label}-${i}`} className={`flex gap-2 rounded-lg px-2.5 py-1.5 text-sm ${correct ? 'bg-good-soft' : 'bg-paper'}`}>
                <span className={`num shrink-0 font-semibold leading-relaxed ${correct ? 'text-good' : 'text-muted'}`}>({o.label})</span>
                <span className="min-w-0 flex-1">
                  <Markdown>{o.content}</Markdown>
                  <OptionPictures figures={optionFigures(q, o.label)} />
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {q.answer.values.length > 0 && !(isChoice && q.options.length && q.answer.values.every((v) => q.options.some((o) => o.label === v))) && (
        <div className="rounded-lg bg-good-soft px-3 py-2 text-sm">
          <span className="font-medium text-good">{SOURCE_LABELS[q.answer.source] ? t('答案（{source}）：', { source: t(SOURCE_LABELS[q.answer.source]) }) : t('答案：')}</span>
          {answerByBlank ? (
            <span>{q.answer.values.map((v, i) => `(${blanks[i]!.label}) ${v}`).join('、')}</span>
          ) : q.answer.values.length === 1 ? (
            <Markdown>{displayAnswer(q.type, q.answer.values[0]!, t)}</Markdown>
          ) : (
            <ol className="list-decimal pl-5">
              {q.answer.values.map((v, i) => (
                <li key={i}>
                  <Markdown>{v}</Markdown>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {q.explanation && !compact && (
        <div className="text-sm">
          <span className="font-medium">{t('詳解：')}</span>
          <Markdown>{q.explanation}</Markdown>
        </div>
      )}

      {!compact && (q.issues.length > 0 || (onConfirm && flagged)) && (
        <ConfirmNote onConfirm={onConfirm}>
          {/* One line high, so the icon centres on the first line of the note. */}
          <span className="flex h-[1.625em] shrink-0 items-center">
            <IconAlert size={16} className="text-warn" aria-label={t('請確認')} />
          </span>
          <div className="min-w-0 flex-1 basis-48 space-y-1 leading-relaxed text-ink/80">
            {q.issues.length ? q.issues.map((issue, i) => <Markdown key={i}>{t(issue)}</Markdown>) : <p>{t('模型對這題的辨識沒有把握，請對照原卷檢查。')}</p>}
          </div>
        </ConfirmNote>
      )}
    </div>
  )
}

function displayAnswer(type: DraftQuestion['type'], value: string, t: T): string {
  if (type === 'true_false') return value === 'true' ? t('○（是）') : value === 'false' ? t('╳（非）') : value
  return value
}

/** A card's first line: number, type, points and the actions on the right. The copy of a card that
 *  follows the pointer while dragged uses it too, so it lines up with the card exactly. */
export function QuestionHeading({ q, showConfidence = false, actions, children }: { q: DraftQuestion; showConfidence?: boolean; actions?: React.ReactNode; children?: React.ReactNode }) {
  const t = useT()
  const { main, part } = splitNumber(q.number)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {part ? (
        // A sub-question: its part stands out, the main number stays quiet.
        <span className="num text-xl leading-none">
          <span className="text-base text-muted">{main}</span>({part})
        </span>
      ) : (
        <span className="num text-xl leading-none">{q.number}.</span>
      )}
      <Badge>{t(TYPE_LABELS[q.type])}</Badge>
      {q.points !== null && <Badge>{t('{points} 分', { points: q.points })}</Badge>}
      {q.maxLength ? <Badge>{t('限 {n} 字', { n: q.maxLength })}</Badge> : null}
      {showConfidence && q.confidence !== 'high' && <Badge tone={q.confidence === 'low' ? 'bad' : 'warn'}>{t(CONFIDENCE_LABELS[q.confidence])}</Badge>}
      {children}
      {actions && <div className="ml-auto flex items-center gap-0.5">{actions}</div>}
    </div>
  )
}
