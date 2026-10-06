import type { Distribution } from '@exam/classes'
import type { T } from '@/shared/i18n/format'
import { Card } from '@/shared/ui'

const percent = (share: number | null) => (share === null ? '—' : `${Math.round(share * 100)}%`)

/** How many students scored in each 10 % band, with the highest, lowest, median and average beside it. */
export function ScoreDistribution({ d, average, t }: { d: Distribution; average: number | null; t: T }) {
  const tallest = Math.max(1, ...d.bands)
  const figures = [
    [t('最高'), d.highest],
    [t('中位數'), d.median],
    [t('平均'), average],
    [t('最低'), d.lowest],
  ] as const
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold">{t('成績分布')}</h2>
      {d.count === 0 ? (
        <p className="text-sm text-muted">{t('有人交卷後會出現。')}</p>
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <div className="flex h-36 items-end gap-[2px] border-b border-line" role="img" aria-label={t('成績分布')}>
              {d.bands.map((n, i) => (
                <div key={i} className="group relative flex h-full flex-1 flex-col justify-end" title={t('{from}–{to}%：{n} 人', { from: i * 10, to: i === 9 ? 100 : i * 10 + 9, n })}>
                  {n > 0 && <span className="num mb-1 text-center text-[11px] text-muted">{n}</span>}
                  <div className={`rounded-t-[4px] transition-colors ${n ? 'bg-accent group-hover:bg-accent/80' : ''}`} style={{ height: `${(n / tallest) * 100}%`, minHeight: n ? 4 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-[2px] text-[10px] text-muted">
              {d.bands.map((_, i) => (
                <span key={i} className="num flex-1 text-center">
                  {i * 10}
                </span>
              ))}
            </div>
            <p className="mt-1 text-right text-[10px] text-muted">{t('得分率（%）')}</p>
          </div>
          <dl className="grid grid-cols-4 gap-3 sm:w-28 sm:grid-cols-1">
            {figures.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className="num text-lg">{percent(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </Card>
  )
}
