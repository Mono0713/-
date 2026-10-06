import type { T } from '@/shared/i18n/format'

export interface ScorePoint {
  label: string
  /** This student's share of the points, 0–1; null when they did not hand it in (or the score is not out yet). */
  mine: number | null
  /** The class average on it. */
  average: number | null
}

const W = 600
const H = 200
const PAD = { left: 34, right: 12, top: 12, bottom: 24 }

/** The student's score on each assignment in order, beside the class average (dashed), on one 0–100 % scale. */
export function ScoreLine({ points, who, t }: { points: ScorePoint[]; who: string; t: T }) {
  const x = (i: number) => PAD.left + (points.length === 1 ? (W - PAD.left - PAD.right) / 2 : (i * (W - PAD.left - PAD.right)) / (points.length - 1))
  const y = (v: number) => PAD.top + (1 - v) * (H - PAD.top - PAD.bottom)
  const path = (key: 'mine' | 'average') =>
    points
      .map((p, i) => (p[key] === null ? null : `${x(i)},${y(p[key]!)}`))
      .reduce<string[][]>((runs, pt) => (pt === null ? [...runs, []] : [...runs.slice(0, -1), [...(runs.at(-1) ?? []), pt]]), [[]])
      .filter((run) => run.length > 1)
      .map((run) => `M${run.join('L')}`)
      .join('')
  const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`)

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('歷次得分率')}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px]">
              {v * 100}%
            </text>
          </g>
        ))}
        <path d={path('average')} fill="none" className="stroke-muted" strokeWidth={2} strokeDasharray="4 4" />
        <path d={path('mine')} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            {p.mine !== null && <circle cx={x(i)} cy={y(p.mine)} r={4} className="fill-accent stroke-surface" strokeWidth={2} />}
            {/* A wide invisible target per assignment, for the tooltip. */}
            <rect x={x(i) - 14} y={PAD.top} width={28} height={H - PAD.top - PAD.bottom} fill="transparent">
              <title>{`${p.label}\n${who} ${pct(p.mine)} · ${t('全班平均')} ${pct(p.average)}`}</title>
            </rect>
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 flex gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-accent" />
          {who}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-muted" />
          {t('全班平均')}
        </span>
      </figcaption>
    </figure>
  )
}
