import type { GridCell, GridRow, QuestionStat } from '@exam/classes'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { msg, type T } from '@/shared/i18n/format'
import { IconCheck, IconMinus, IconX } from '@/shared/icons'
import { Card } from '@/shared/ui'

type Shown = 'correct' | 'partial' | 'wrong' | 'unanswered' | 'pending'

/** Each result as a mark and a tint, so it reads without colour too. */
const LOOK: Record<Shown, { tint: string; mark: ReactNode; name: string }> = {
  correct: { tint: 'bg-good-soft text-good', mark: <IconCheck size={14} strokeWidth={2.5} />, name: msg('答對') },
  partial: { tint: 'bg-warn-soft text-ink/80', mark: <span className="text-[11px] font-semibold">½</span>, name: msg('部分') },
  wrong: { tint: 'bg-bad-soft text-bad', mark: <IconX size={14} strokeWidth={2.5} />, name: msg('答錯') },
  unanswered: { tint: 'bg-ink/[0.04] text-muted', mark: <IconMinus size={12} />, name: msg('沒寫') },
  pending: { tint: 'bg-accent-soft text-accent', mark: <span className="text-[11px] font-semibold">?</span>, name: msg('待批改') },
}

const shown = (c: GridCell): Shown | null => (c.status === 'no_key' ? null : c.status)
const percent = (share: number | null) => (share === null ? '—' : `${Math.round(share * 100)}%`)

/**
 * Every student against every question at a glance. A square opens that student's answer to
 * that question; a question number opens everyone's answers to it, to read and mark in a row.
 */
export function AnswerGrid({ classId, assignmentId, questions, rows, t }: { classId: string; assignmentId: string; questions: QuestionStat[]; rows: GridRow[]; t: T }) {
  const base = `/classes/${classId}/a/${assignmentId}`
  const handedIn = rows.filter((r) => r.attemptId)
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-sm font-semibold">{t('每題對錯')}</h2>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          {(Object.keys(LOOK) as Shown[]).map((k) => (
            <li key={k} className="flex items-center gap-1">
              <span className={`grid size-4 place-items-center rounded ${LOOK[k].tint}`}>{LOOK[k].mark}</span>
              {t(LOOK[k].name)}
            </li>
          ))}
        </ul>
      </div>
      <p className="mb-3 text-xs text-muted">{t('點方格看那位學生那一題的答案；點題號看全班那一題的答案，可以一題一題批改。')}</p>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="border-separate border-spacing-1 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-surface" />
              {questions.map((q) => (
                <th key={q.questionId} className="p-0 font-normal">
                  <Link href={`${base}/q/${q.questionId}`} title={t('看全班第 {n} 題的答案', { n: q.number })} className="num grid h-7 min-w-7 place-items-center rounded px-1 text-xs text-muted hover:bg-accent-soft hover:text-accent">
                    {q.number}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {handedIn.map((r) => (
              <tr key={r.userId}>
                <th scope="row" className="sticky left-0 z-10 max-w-32 truncate bg-surface pr-2 text-left font-medium">
                  <Link href={`${base}/r/${r.attemptId}`} className="hover:text-accent hover:underline">
                    {r.left ? t('已退出的學生') : r.name}
                  </Link>
                </th>
                {r.cells.map((c, i) => {
                  const k = c && shown(c)
                  const q = questions[i]!
                  if (!c || !k) return <td key={q.questionId} className="size-7 rounded bg-ink/[0.02]" />
                  return (
                    <td key={q.questionId} className="p-0">
                      <Link
                        href={`${base}/r/${r.attemptId}?q=${c.index}`}
                        title={`${r.name} · ${t('第 {n} 題', { n: q.number })} · ${t(LOOK[k].name)} ${c.score} / ${c.max}`}
                        className={`m-press grid size-7 place-items-center rounded ${LOOK[k].tint} hover:ring-2 hover:ring-accent/50`}
                      >
                        {LOOK[k].mark}
                      </Link>
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <th scope="row" className="sticky left-0 z-10 bg-surface pr-2 text-left text-xs font-medium text-muted">
                {t('得分率')}
              </th>
              {questions.map((q) => (
                <td key={q.questionId} className={`num text-center text-[11px] ${q.rate !== null && q.rate < 0.5 ? 'text-bad' : 'text-muted'}`}>
                  {percent(q.rate)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  )
}
