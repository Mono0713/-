import type { DraftQuestion } from '@exam/core'

const squash = (s: string) => s.replace(/\s+/g, '')

/** Whether two marking rules say the same thing, spacing aside. */
export const sameRule = (a: string | null | undefined, b: string | null | undefined) => !!a?.trim() && !!b?.trim() && squash(a) === squash(b)

/** The marking rule every question of a group shares, shown once above them; null when they differ or have none. */
export function sharedRule(parts: Pick<DraftQuestion, 'markingRule'>[]): string | null {
  const first = parts[0]?.markingRule?.trim()
  return parts.length > 1 && first && parts.every((p) => sameRule(p.markingRule, first)) ? first : null
}

/**
 * Text without the marking rule written into it as well (e.g. a stem ending in 「（列式 2 分，答案 2 分，共 8 分）」),
 * since the rule shows on its own line. Spacing inside the rule may differ; brackets around it go too.
 */
export function withoutRule(text: string, rule: string | null | undefined): string {
  const r = rule ? squash(rule) : ''
  if (!r || !text) return text
  const body = [...r].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*')
  return text.replace(new RegExp(`\\s*[(（]\\s*${body}\\s*[)）]|${body}`, 'g'), '').trim()
}
