import { IconClass } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import type { Sample } from '../samples/types'
import { mix, ramp, rise } from './tween'
import { SceneLayout } from './SceneLayout'

/** How many students scored in each band of ten, 40–49 up to 90–100. */
const BANDS = [1, 2, 4, 9, 8, 6]
const BY_QUESTION = [93, 86, 61]

/** The class's results filling in as the sheets come back: the count, the average, the spread and the rate per question. */
export function ClassScene({ s, tall, sample }: { s: number; tall: boolean; sample: Sample }) {
  const t = useT()
  const counted = ramp(s, 0.5, 1.4)
  const most = Math.max(...BANDS)
  return (
    <SceneLayout s={s} tall={tall} step={6} title={t('派給全班')} text={t('分享連結或派成作業，交卷後成績和每題得分率自動整理好。')}>
      <div className="absolute inset-x-2 top-6 rounded-2xl bg-surface p-5 shadow-sheet">
        <p className="flex items-center gap-2 text-[15px] font-bold">
          <IconClass size={17} aria-hidden className="text-accent" />
          {t(sample.subject)} {t(sample.exam)}
        </p>
        <p className="mt-1 text-sm text-muted">{t('{n} / {total} 人已交卷', { n: Math.round(mix(0, 30, counted)), total: 30 })}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            [t('平均'), Math.round(mix(0, 82, counted))],
            [t('最高'), Math.round(mix(0, 100, counted))],
            [t('最低'), Math.round(mix(0, 48, counted))],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-paper py-2">
              <p className="num text-[22px] font-bold tabular-nums leading-tight">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-xs font-semibold text-muted">{t('成績分布')}</p>
        <div className="mt-2 flex h-24 items-end gap-2 border-b border-line">
          {BANDS.map((n, i) => (
            <span key={i} className="flex-1 origin-bottom rounded-t-md bg-accent/80" style={{ height: `${(n / most) * 100}%`, transform: `scaleY(${ramp(s, 0.6 + i * 0.1, 0.7)})` }} />
          ))}
        </div>
        <p className="mt-5 text-xs font-semibold text-muted">{t('每題得分率')}</p>
        <ul className="mt-2 grid gap-2 text-[13px]">
          {BY_QUESTION.map((rate, i) => {
            const p = ramp(s, 1.6 + i * 0.15, 0.8)
            return (
              <li key={i} className="flex items-center gap-3" style={rise(ramp(s, 1.5 + i * 0.15, 0.4), 4)}>
                <span className="num w-5 text-muted">{i + 1}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-line/60">
                  <span className={`block h-full origin-left rounded-full ${rate < 70 ? 'bg-warn' : 'bg-good'}`} style={{ width: `${rate}%`, transform: `scaleX(${p})` }} />
                </span>
                <span className="num w-10 text-right tabular-nums">{Math.round(rate * p)}%</span>
              </li>
            )
          })}
        </ul>
      </div>
    </SceneLayout>
  )
}
