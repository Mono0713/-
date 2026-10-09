import type { CSSProperties } from 'react'

/**
 * The tour is drawn from its clock: every scene gets its own time `t` in seconds and works out each
 * piece's look from it, so pausing, jumping to a chapter and reduced motion all come for free.
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
export const easeOut = (v: number) => 1 - (1 - v) ** 3
export const easeInOut = (v: number) => (v < 0.5 ? 4 * v ** 3 : 1 - (-2 * v + 2) ** 3 / 2)

/** 0 before `from`, 1 after `from + dur`, eased in between. */
export const ramp = (t: number, from: number, dur: number, curve = easeOut) => curve(clamp01((t - from) / dur))

export const mix = (a: number, b: number, p: number) => a + (b - a) * p

/** Fades in while rising a few pixels. */
export const rise = (p: number, y = 10): CSSProperties => ({ opacity: p, transform: p < 1 ? `translateY(${(1 - p) * y}px)` : undefined })

/** Grows from a little smaller, for things that appear in place (a chip, a stamp). */
export const pop = (p: number, from = 0.92): CSSProperties => ({ opacity: p, transform: p < 1 ? `scale(${mix(from, 1, p)})` : undefined })

/** Uncovers from the left, as if written or swept on. */
export const sweep = (p: number): CSSProperties => ({ clipPath: `inset(-20% ${(1 - p) * 100}% -20% 0)` })

/** Where something moving along `[time, x, y]` stops is at `t` (it rests at each stop until the next leg starts). */
export function along(t: number, stops: [number, number, number][]): { x: number; y: number } {
  let [, x, y] = stops[0]!
  for (let i = 1; i < stops.length; i++) {
    const [from] = stops[i - 1]!
    const [to, nx, ny] = stops[i]!
    // each leg takes the last 0.7 s before its stop
    const p = ramp(t, Math.max(from, to - 0.7), Math.min(0.7, to - from), easeInOut)
    x = mix(x, nx, p)
    y = mix(y, ny, p)
  }
  return { x, y }
}
