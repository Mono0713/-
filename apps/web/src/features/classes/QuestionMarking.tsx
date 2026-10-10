'use client'

import { isEmptyInk } from '@exam/ink'
import type { Grade, Marking, QuizItem, QuizResponse } from '@exam/quiz'
import { answerKind, matches, toPaperLabels } from '@exam/quiz/logic'
import Link from 'next/link'
import { useState } from 'react'
import { QuizQuestion } from '@/features/quiz/QuizQuestion'
import { GRADE_LABELS } from '@/features/quiz/Reveal'
import { Segmented } from '@/shared/Segmented'
import { useT } from '@/shared/i18n/client'
import { Markdown } from '@/shared/Markdown'
import { Badge, Card } from '@/shared/ui'
import { MarkBox } from './MarkBox'

/** One student's answer to the question, in the attempt they handed in. */
export interface StudentAnswer {
  name: string
  attemptId: string
  /** Where the question sits in their attempt. */
  index: number
  /** The question as that student saw it (their option order and labels). */
  item: QuizItem
  response: QuizResponse | null
  marking: Marking | null
  grade: Grade
}

type Filter = 'all' | 'pending' | 'lost'
const FILTERS: Record<Exclude<Filter, 'all'>, Grade['status'][]> = { pending: ['pending'], lost: ['wrong', 'partial', 'unanswered'] }

/**
 * Everyone's answer to one question under the question and its key, so a teacher reads them in
 * a row and marks the open ones without opening each paper.
 */
export function QuestionMarking({ paper, position, answers, reviewBase }: { paper: QuizItem; position: number; answers: StudentAnswer[]; reviewBase: string }) {
  const t = useT()
  const q = paper.question
  const kind = answerKind(q)
  const choice = kind.kind === 'single' || kind.kind === 'multiple' || kind.kind === 'true_false'
  const count = (s: Grade['status'][]) => answers.filter((a) => s.includes(a.grade.status)).length
  const inFilter = (f: Filter) => answers.filter((a) => f === 'all' || FILTERS[f].includes(a.grade.status)).map((a) => a.attemptId)
  // A filter keeps the answers it found, so one just marked stays in view instead of leaving the list.
  const [filter, setFilter] = useState<{ by: Filter; ids: Set<string> }>(() => {
    const by: Filter = count(['pending']) ? 'pending' : 'all'
    return { by, ids: new Set(inFilter(by)) }
  })
  const shown = filter.by === 'all' ? answers : answers.filter((a) => filter.ids.has(a.attemptId))
  const key = q.answer.values

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <QuizQuestion item={paper} index={position} response={null} reveal />
        {!choice && key.some((v) => v.trim()) && kind.kind !== 'writing' && (
          <div className="rounded-lg border border-line bg-paper p-3 text-sm">
            <span className="font-medium text-good">{t('正確答案：')}</span>
            {key.length === 1 ? (
              <Markdown className="hl-md">{key[0]!}</Markdown>
            ) : (
              <ol className="list-decimal pl-5">
                {key.map((v, i) => (
                  <li key={i}>
                    <Markdown>{v}</Markdown>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {(['correct', 'partial', 'wrong', 'unanswered', 'pending'] as const).map((s) => (
            <span key={s}>
              {t(GRADE_LABELS[s][0])} <span className="num font-semibold text-ink">{count([s])}</span>
            </span>
          ))}
        </p>
      </Card>

      <Segmented
        value={filter.by}
        onChange={(by) => setFilter({ by, ids: new Set(inFilter(by)) })}
        options={
          [
            ['all', t('全部 {n}', { n: answers.length })],
            ['pending', t('待批改 {n}', { n: count(['pending']) })],
            ['lost', t('失分 {n}', { n: count(['wrong', 'partial', 'unanswered']) })],
          ] as const
        }
      />

      {shown.map((a) => {
        const [label, tone] = GRADE_LABELS[a.grade.status]
        return (
          <Card key={a.attemptId} className="m-enter space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`${reviewBase}/${a.attemptId}?q=${a.index}`} title={a.name} className="max-w-60 truncate font-medium hover:text-accent hover:underline">
                {a.name}
              </Link>
              <Badge tone={tone}>{t(label)}</Badge>
              {a.grade.max > 0 && <span className="num text-sm text-muted">{t('{score} / {max} 分', { score: a.grade.score, max: a.grade.max })}</span>}
              {a.marking?.by === 'ai' && <Badge tone="accent">{t('AI 批改')}</Badge>}
              {a.marking?.by === 'teacher' && <Badge tone="accent">{t('老師批改')}</Badge>}
            </div>
            <Answer a={a} />
            {a.marking?.by === 'ai' && a.marking.feedback && <Markdown className="pen text-sm">{a.marking.feedback}</Markdown>}
            {!choice && a.grade.status !== 'unanswered' && <MarkBox attemptId={a.attemptId} index={a.index} marking={a.marking} />}
          </Card>
        )
      })}
      {!shown.length && <p className="text-sm text-muted">{answers.length ? t('沒有符合的答案。') : t('還沒有人交卷。')}</p>}
    </div>
  )
}

/** What the student wrote: picks and blanks in one line, written and drawn answers as they were handed in. */
function Answer({ a }: { a: StudentAnswer }) {
  const t = useT()
  const q = a.item.question
  const kind = answerKind(q)
  const values = a.response?.values ?? []
  const key = q.answer.values
  const none = <p className="text-sm text-muted">{t('沒有作答')}</p>

  if (kind.kind === 'single' || kind.kind === 'multiple') {
    if (!values.length) return none
    // Picks are kept in the paper's labels, the ones shown above.
    return (
      <ul className="space-y-1 text-sm">
        {q.options
          .filter((o) => values.includes(o.label))
          .map((o) => (
            <li key={o.label} className={`flex items-baseline gap-2 ${key.includes(o.label) ? 'text-good' : 'text-bad'}`}>
              <span className="num shrink-0 font-semibold">({o.label})</span>
              <Markdown className="min-w-0 text-ink">{o.content}</Markdown>
            </li>
          ))}
      </ul>
    )
  }
  if (kind.kind === 'true_false') {
    if (!values[0]) return none
    return <p className={`text-sm font-medium ${values[0] === key[0] ? 'text-good' : 'text-bad'}`}>{values[0] === 'true' ? t('○ 是') : t('╳ 非')}</p>
  }
  const inked = !isEmptyInk(a.response?.handwriting)
  if (kind.kind === 'blanks' && !inked) {
    if (!values.some((v) => v.trim())) return none
    return (
      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {Array.from({ length: kind.count }, (_, i) => {
          const v = toPaperLabels(a.item, values[i] ?? '')
          return (
            <li key={i} className="flex items-baseline gap-1.5">
              <span className="text-xs text-muted">({i + 1})</span>
              <span className={v.trim() ? (matches(key[i] ?? '', v) ? 'text-good' : 'text-bad') : 'text-muted'}>{v.trim() || t('（空白）')}</span>
            </li>
          )
        })}
      </ol>
    )
  }
  if (kind.kind === 'text' && !inked && q.type !== 'drawing') {
    if (!values[0]?.trim()) return none
    return <div className="whitespace-pre-wrap break-words rounded-lg border border-line bg-paper px-3 py-2 text-sm">{values[0]}</div>
  }
  // Handwriting, drawings and writing practice are shown as written.
  return <QuizQuestion item={a.item} index={a.index} response={a.response} reveal answerOnly />
}
