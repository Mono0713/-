import type { IntegrityEvent } from '@exam/quiz'

/** What an attempt's integrity events add up to, for the teacher's table and the export. */
export function integrityCounts(events: IntegrityEvent[]): { away: number; awayMs: number; screenshots: number; copies: number } {
  const away = events.filter((e) => e.kind === 'hidden' || e.kind === 'blur' || e.kind === 'fullscreen')
  return {
    away: away.length,
    awayMs: away.reduce((ms, e) => ms + (e.ms ?? 0), 0),
    screenshots: events.filter((e) => e.kind === 'screenshot').length,
    copies: events.filter((e) => e.kind === 'copy' || e.kind === 'paste').length,
  }
}
