import { typeRates } from '@exam/classes'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { integrityCounts } from '@/features/classes/integrityCounts'
import { LocalTime } from '@/features/classes/LocalTime'
import { ScoreLine } from '@/features/classes/ScoreLine'
import { inClass, resultsWithheld } from '@/server/classes'
import { gradebook } from '@/server/gradebook'
import { getT } from '@/shared/i18n/server'
import { TYPE_LABELS } from '@/shared/labels'
import { Badge, Card, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const t = await getT()
  return { title: t('個人成績') }
}

const percent = (share: number | null) => (share === null ? '—' : `${Math.round(share * 100)}%`)

/** One student's results across the class's assignments: for their teachers, and for the student themselves. */
export default async function StudentPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = await params
  const t = await getT()
  const found = await inClass(id)
  const self = found?.me.userId === userId
  if (!found || (!found.teaches && !self)) notFound()
  const book = await gradebook(found.classroom.id)
  const member = book.members.find((m) => m.userId === userId)
  const name = self ? t('我的成績') : (member?.name ?? t('已退出的學生'))

  // A student's own page keeps a score hidden while the answers of that assignment are not out.
  const rows = await Promise.all(
    book.assignments.map(async ({ assignment, stats, attempts }) => {
      const r = stats.students.find((x) => x.userId === userId)
      const counted = r?.counted?.handedIn ? r.counted : null
      const attempt = counted ? (attempts.find((x) => x.id === counted.attemptId) ?? null) : null
      const hidden = attempt && !found.teaches ? await resultsWithheld(attempt) : false
      return {
        assignment,
        counted,
        attempt,
        hidden,
        mine: counted && !hidden && counted.max ? counted.score / counted.max : null,
        average: hidden ? null : stats.average,
        away: found.teaches && r?.counted ? integrityCounts(attempts.find((x) => x.id === r.counted!.attemptId)?.integrity ?? []).away : null,
      }
    }),
  )
  const scored = rows.filter((r) => r.mine !== null)
  const mean = scored.length ? scored.reduce((n, r) => n + r.mine!, 0) / scored.length : null
  const weak = typeRates(rows.flatMap((r) => (r.attempt && !r.hidden ? [r.attempt] : []))).filter((x) => x.max > 0)

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title={name}
        subtitle={
          <Link href={`/classes/${found.classroom.id}`} className="hover:underline">
            {found.classroom.name}
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title={t('還沒有作業')}>{t('老師派作業後會出現在這裡。')}</EmptyState>
      ) : (
        <>
          <Card className="flex flex-wrap gap-x-10 gap-y-3 p-5">
            <div>
              <p className="text-xs text-muted">{t('已交')}</p>
              <p className="num text-3xl">
                {rows.filter((r) => r.counted).length}
                <span className="text-lg text-muted"> / {rows.length}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">{t('平均得分率')}</p>
              <p className="num text-3xl">{percent(mean)}</p>
            </div>
          </Card>

          {scored.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold">{t('歷次得分率')}</h2>
              <ScoreLine points={rows.map((r) => ({ label: r.assignment.title, mine: r.mine, average: r.average }))} who={self ? t('我') : (member?.name ?? '')} t={t} />
            </Card>
          )}

          {weak.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-1 text-sm font-semibold">{t('各題型得分率')}</h2>
              <p className="mb-3 text-xs text-muted">{t('由低到高，最上面是最常失分的題型。')}</p>
              <ul className="space-y-1.5">
                {weak.map((w) => (
                  <li key={w.type} className="flex items-center gap-3 text-sm">
                    <span className="w-24 shrink-0 truncate">{t(TYPE_LABELS[w.type as keyof typeof TYPE_LABELS] ?? w.type)}</span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
                      <span className={`absolute inset-y-0 left-0 rounded-full ${w.score / w.max < 0.5 ? 'bg-bad' : 'bg-good'}`} style={{ width: `${Math.round((w.score / w.max) * 100)}%` }} />
                    </span>
                    <span className="num w-11 shrink-0 text-right">{percent(w.score / w.max)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="overflow-x-auto p-2">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">{t('作業')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('得分')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('全班平均')}</th>
                  <th className="px-3 py-2 font-medium">{t('交卷時間')}</th>
                  {found.teaches && <th className="px-3 py-2 text-right font-medium">{t('離開畫面')}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.assignment.id} className="border-t border-line/70">
                    <td className="px-3 py-2">
                      <Link href={found.teaches && r.counted ? `/classes/${found.classroom.id}/a/${r.assignment.id}/r/${r.counted.attemptId}` : `/classes/${found.classroom.id}/a/${r.assignment.id}`} className="hover:text-accent hover:underline">
                        {r.assignment.title}
                      </Link>
                    </td>
                    <td className="num px-3 py-2 text-right">{!r.counted ? <Badge tone="warn">{t('未交')}</Badge> : r.hidden ? t('已交') : `${r.counted.score} / ${r.counted.max}`}</td>
                    <td className="num px-3 py-2 text-right text-muted">{percent(r.average)}</td>
                    <td className="px-3 py-2 text-muted">{r.counted?.finishedAt ? <LocalTime at={r.counted.finishedAt} /> : '—'}</td>
                    {found.teaches && <td className="num px-3 py-2 text-right text-muted">{r.away ?? '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  )
}
