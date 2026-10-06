import { isOpen, type Assignment, type StudentException } from './types.ts'

/** The rules one student works under: the assignment's own, changed by their exception if they have one. */
export interface StudentRules {
  closesAt: string | null
  maxAttempts: number | null
  timeLimitMinutes: number | null
  exception: StudentException | null
}

export function rulesFor(a: Assignment, userId: string): StudentRules {
  const e = a.settings.exceptions?.[userId] ?? null
  const s = a.settings
  return {
    closesAt: e?.closesAt ?? a.closesAt,
    maxAttempts: s.maxAttempts === null ? null : s.maxAttempts + (e?.extraAttempts ?? 0),
    timeLimitMinutes: s.timeLimitMinutes === null ? null : s.timeLimitMinutes + (e?.extraMinutes ?? 0),
    exception: e,
  }
}

/** Whether this student may start the assignment now, with their own deadline. */
export function isOpenFor(a: Assignment, userId: string, now = new Date()): boolean {
  return isOpen({ opensAt: a.opensAt, closesAt: rulesFor(a, userId).closesAt }, now)
}

/**
 * When the last student's time is up: the class deadline, or a later personal one. Answers
 * that wait for the deadline wait for this, so nobody still writing can be shown them.
 */
export function lastClose(a: Assignment): string | null {
  if (!a.closesAt) return null
  const personal = Object.values(a.settings.exceptions ?? {}).flatMap((e) => (e.closesAt ? [e.closesAt] : []))
  return [a.closesAt, ...personal].reduce((latest, x) => (new Date(x) > new Date(latest) ? x : latest))
}
