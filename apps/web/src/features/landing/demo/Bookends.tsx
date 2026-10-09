import type { ReactNode } from 'react'
import { BRAND, brandTagline } from '@/shared/brand/brand'
import { MARK_SHEET } from '@/shared/brand/LogoMark'
import { useLocale, useT } from '@/shared/i18n/client'
import { rich } from '@/shared/i18n/rich'
import { pop, ramp, rise } from './tween'

/** The mark drawing itself: the sheet settles, then the loop is written around its corner. */
function Mark({ s, size }: { s: number; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden className="text-accent" style={pop(ramp(s, 0, 0.5), 0.9)}>
      <g transform="translate(-2 -1)">
        <path d={MARK_SHEET} fill="currentColor" />
        <circle cx="46" cy="47" r="8.5" stroke="currentColor" strokeWidth="5" pathLength={1} strokeDasharray="1 2" strokeDashoffset={1 - ramp(s, 0.35, 0.6)} transform="rotate(-90 46 47)" />
      </g>
    </svg>
  )
}

/** Opens the tour: the logo, the name and the tagline. */
export function IntroScene({ s }: { s: number }) {
  const locale = useLocale()
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <Mark s={s} size={88} />
      <p className="mt-5 font-display text-[52px] font-extrabold lowercase leading-none tracking-[-0.035em]" style={rise(ramp(s, 0.55, 0.6))}>
        {BRAND.name}
      </p>
      <p className="mt-4 text-[18px] text-muted" style={rise(ramp(s, 0.85, 0.6))}>
        {brandTagline(locale)}
      </p>
    </div>
  )
}

/** Closes the tour on the page's promise and its call to action. */
export function OutroScene({ s, tall, cta }: { s: number; tall: boolean; cta: ReactNode }) {
  const t = useT()
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
      <Mark s={s} size={56} />
      <h2 className={`mt-6 max-w-[34rem] font-display font-extrabold leading-[1.15] tracking-[-0.03em] [text-wrap:balance] ${tall ? 'text-[32px]' : 'text-[44px]'}`} style={rise(ramp(s, 0.3, 0.6))}>
        {rich(t('把寫過的考卷，<hl>變成練不完的題庫</hl>'), {
          hl: (c) => (
            <span className="hl inline-block" style={{ backgroundSize: `${ramp(s, 0.8, 0.5) * 100}% 100%`, backgroundRepeat: 'no-repeat' }}>
              {c}
            </span>
          ),
        })}
      </h2>
      {/* a click on the button is not a click on the picture (which pauses or replays) */}
      <div className="mt-8" style={rise(ramp(s, 1.1, 0.6))} onClick={(e) => e.stopPropagation()}>
        {cta}
      </div>
    </div>
  )
}
