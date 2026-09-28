'use client'

import { useCountUp } from './AnimatedNumber'

/** A circular progress ring (0..1) that fills in step with AnimatedNumber's count-up. */
export function ProgressRing({ value, size = 72, stroke = 8, tone = 'var(--color-accent)', duration = 900 }: { value: number; size?: number; stroke?: number; tone?: string; duration?: number }) {
  const r = (size - stroke) / 2
  const shown = useCountUp(Math.max(0, Math.min(1, value)), duration)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke} strokeLinecap="round"
        pathLength={1} strokeDasharray={`${shown} 1`} opacity={shown > 0.001 ? 1 : 0}
      />
    </svg>
  )
}
