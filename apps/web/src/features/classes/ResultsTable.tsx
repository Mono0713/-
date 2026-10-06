import type { Assignment, StudentResult } from '@exam/classes'
import type { IntegrityEvent } from '@exam/quiz'
import Link from 'next/link'
import type { T } from '@/shared/i18n/format'
import { Badge, Card } from '@/shared/ui'
import { ExceptionEditor } from './ExceptionEditor'
import { integrityCounts } from './integrityCounts'
import { LocalTime } from './LocalTime'

/** Every student of the assignment: where they are, their score, what the exam page noticed, and their own extension. */
export function ResultsTable({ classId, assignment, students, integrity, t }: { classId: string; assignment: Assignment; students: StudentResult[]; integrity: Map<string, IntegrityEvent[]>; t: T }) {
  const exam = assignment.settings.mode === 'exam'
  return (
    <Card className="overflow-x-auto p-2">
      <table className="w-full min-w-[36rem] whitespace-nowrap text-sm">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="px-3 py-2 font-medium">{t('學生')}</th>
            <th className="px-3 py-2 font-medium">{t('狀態')}</th>
            <th className="px-3 py-2 text-right font-medium">{t('得分')}</th>
            <th className="px-3 py-2 text-right font-medium">{t('次數')}</th>
            <th className="px-3 py-2 font-medium">{t('交卷時間')}</th>
            {exam && <th className="px-3 py-2 font-medium">{t('離開畫面')}</th>}
            <th />
            <th />
          </tr>
        </thead>
        <tbody>
          {students.map((r) => {
            const c = r.counted
            const n = c ? integrityCounts(integrity.get(c.attemptId) ?? []) : null
            return (
              <tr key={r.userId} className="border-t border-line/70 hover:bg-paper">
                <td className={`px-3 py-2 font-medium ${r.left ? 'text-muted' : ''}`}>
                  {r.left ? (
                    t('已退出的學生')
                  ) : (
                    <Link href={`/classes/${classId}/s/${r.userId}`} className="hover:text-accent hover:underline">
                      {r.name}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2">
                  {!c ? (
                    <Badge tone="warn">{t('未交')}</Badge>
                  ) : !c.handedIn ? (
                    <Badge tone="accent">{t('作答中')}</Badge>
                  ) : c.pending ? (
                    <Badge tone="accent">{t('待批改 {n}', { n: c.pending })}</Badge>
                  ) : (
                    <Badge tone="good">{t('已交')}</Badge>
                  )}
                </td>
                <td className="num px-3 py-2 text-right">{c?.handedIn && c.max ? `${c.score} / ${c.max}` : '—'}</td>
                <td className="num px-3 py-2 text-right text-muted">{r.tries || '—'}</td>
                <td className="px-3 py-2 text-muted">{c?.finishedAt ? <LocalTime at={c.finishedAt} /> : '—'}</td>
                {exam && (
                  <td className="px-3 py-2">
                    {!n ? (
                      <span className="text-muted">—</span>
                    ) : n.away + n.screenshots + n.copies === 0 ? (
                      <span className="num text-muted">0</span>
                    ) : (
                      <span className="flex flex-wrap gap-1" title={t('離開畫面 {away} 次，截圖鍵 {shots} 次，複製貼上 {copies} 次', { away: n.away, shots: n.screenshots, copies: n.copies })}>
                        {n.away > 0 && <Badge tone="warn">{t('離開 {n}', { n: n.away })}</Badge>}
                        {n.screenshots > 0 && <Badge tone="bad">{t('截圖 {n}', { n: n.screenshots })}</Badge>}
                        {n.copies > 0 && <Badge tone="neutral">{t('複製 {n}', { n: n.copies })}</Badge>}
                      </span>
                    )}
                  </td>
                )}
                {/* 延長 and 批改 keep their own columns, so neither moves when the other is missing. */}
                <td className="w-px whitespace-nowrap py-2 pl-3 text-right">
                  {!r.left && <ExceptionEditor assignmentId={assignment.id} userId={r.userId} name={r.name} value={assignment.settings.exceptions?.[r.userId] ?? null} timed={exam && assignment.settings.timeLimitMinutes !== null} />}
                </td>
                <td className="w-px whitespace-nowrap px-3 py-2 text-right">
                  {c?.handedIn ? (
                    <Link href={`/classes/${classId}/a/${assignment.id}/r/${c.attemptId}`} className="text-accent hover:underline">
                      {t('批改')}
                    </Link>
                  ) : (
                    <span className="invisible" aria-hidden>
                      {t('批改')}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
          {students.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-muted">
                {t('班上還沒有學生。把加入碼給學生，他們加入後會出現在這裡。')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  )
}
