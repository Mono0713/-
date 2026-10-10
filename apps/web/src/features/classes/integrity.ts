'use server'

import type { IntegrityEvent } from '@exam/quiz'
import { services } from '@/server/context'
import { ownedAttempt } from '@/server/owned'

const KINDS: IntegrityEvent['kind'][] = ['hidden', 'blur', 'fullscreen', 'screenshot', 'copy', 'paste']
/** Enough for any honest exam; a page sending more is cut off rather than filling the attempt. */
const MOST = 500

/** Adds what the exam page noticed to the student's own class attempt while it is being written. */
export async function logIntegrity(attemptId: string, events: IntegrityEvent[]): Promise<void> {
  const attempt = await ownedAttempt(attemptId)
  if (!attempt?.assignment || attempt.assignment.preview || attempt.finishedAt || !Array.isArray(events)) return
  const clean = events.slice(0, 50).flatMap((e): IntegrityEvent[] => {
    if (!KINDS.includes(e?.kind) || typeof e.at !== 'string' || Number.isNaN(Date.parse(e.at))) return []
    const ms = typeof e.ms === 'number' && Number.isFinite(e.ms) && e.ms > 0 ? Math.min(Math.round(e.ms), 86_400_000) : undefined
    return [{ kind: e.kind, at: new Date(e.at).toISOString(), ...(ms !== undefined && { ms }) }]
  })
  if (!clean.length) return
  await services().quizzes.update(attemptId, (a) => (a.finishedAt ? null : { ...a, integrity: [...(a.integrity ?? []), ...clean].slice(0, MOST) }))
}
