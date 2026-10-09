import type { ReactNode } from 'react'
import { ramp, rise } from './tween'

/** The visual of every scene is drawn on this square-ish card, whatever the stage's shape. */
export const VISUAL = { w: 440, h: 520 }

/**
 * One chapter of the tour: what it is about beside the picture on a wide stage, above it on a
 * phone held upright (the picture is then drawn a little smaller).
 */
export function SceneLayout({ s, tall, step, title, text, children }: { s: number; tall: boolean; step: number; title: string; text: string; children: ReactNode }) {
  return (
    <div className={`absolute inset-0 flex ${tall ? 'flex-col items-center px-6 pt-8' : 'items-center gap-12 pl-14 pr-10'}`}>
      <div className={tall ? 'h-[196px] w-full' : 'w-[340px] shrink-0'}>
        <p className="num text-sm font-semibold text-accent" style={rise(ramp(s, 0.05, 0.5), 6)}>
          {String(step).padStart(2, '0')}
        </p>
        <h2 className={`mt-2 font-display font-extrabold leading-[1.15] tracking-[-0.02em] [text-wrap:balance] ${tall ? 'text-[30px]' : 'text-[40px]'}`} style={rise(ramp(s, 0.12, 0.55))}>
          {title}
        </h2>
        <p className={`mt-3 leading-relaxed text-muted [text-wrap:pretty] ${tall ? 'text-[15px]' : 'text-[17px]'}`} style={rise(ramp(s, 0.22, 0.55))}>
          {text}
        </p>
      </div>
      <div className={`relative shrink-0 ${tall ? 'origin-top scale-[0.9]' : ''}`} style={{ width: VISUAL.w, height: VISUAL.h }}>
        {children}
      </div>
    </div>
  )
}
