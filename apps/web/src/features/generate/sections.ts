import type { DraftExam, QuestionType } from '@exam/core'

export interface Headings {
  /** A section of one question type, e.g. 「單選題」. */
  type: (type: QuestionType) => string
  /** The section holding the groups (題組). */
  group: string
}

/**
 * Orders a written exam the way a printed one reads: one section per question type in the order asked
 * for, then the groups (題組) together at the end, numbered 1, 2, 3… throughout. Each section gets a
 * heading such as 「一、單選題」 (I., II. … outside Chinese and Japanese).
 */
export function withSections(draft: DraftExam, headings: Headings, order: QuestionType[], locale: string): DraftExam {
  const rank = (type: QuestionType) => (order.includes(type) ? order.indexOf(type) : order.length)
  const single = draft.questions.filter((q) => !q.groupId).sort((a, b) => rank(a.type) - rank(b.type))
  const grouped = draft.groups.flatMap((g) => draft.questions.filter((q) => q.groupId === g.id))
  const titles = new Map<string, string>()
  const title = (name: string) => {
    if (!titles.has(name)) titles.set(name, `${numeral(titles.size + 1, locale)}${name}`)
    return titles.get(name)!
  }
  const questions = [...single, ...grouped].map((q, i) => ({ ...q, number: String(i + 1), section: title(q.groupId ? headings.group : headings.type(q.type)) }))
  return { ...draft, questions }
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
// Section numerals of Chinese and Japanese papers, not interface text.
const HAN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'] // i18n-ignore

/** 「一、」 for Chinese and Japanese, 「I. 」 elsewhere. */
function numeral(n: number, locale: string): string {
  if (/^(zh|ja)/.test(locale)) return `${HAN[n - 1] ?? n}、`
  return `${ROMAN[n - 1] ?? n}. `
}
