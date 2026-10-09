import type { ExamMeta } from './schema.ts'

/**
 * Printed headings that only name the form, not the exam: 考試命題紙, 試題卷, 答案卷, "Exam paper"…
 * They say nothing about which exam it is, so a title like this gives way to one made of the subject and term.
 */
const FORM_NAME = /^\s*(?:考試|測驗|期[中末]考?)?\s*(?:命題紙|命題|試題紙|試題卷|試題|試卷|考卷|題目卷|題目|答案卷|答案紙|答案|作答紙|答題卷|答題紙|考試卷|考試|測驗卷|測驗)\s*$|^\s*(?:exam(?:ination)?|test|quiz)(?:\s+(?:paper|sheet))?\s*$/i

/** Whether `title` only names the form (考試命題紙) and says nothing about the exam. */
export function isFormName(title: string | null | undefined): boolean {
  return !title?.trim() || FORM_NAME.test(title)
}

/**
 * The meta with a title worth reading: one that only names the form becomes subject and term,
 * e.g. 「實用英文(一) 113 學年度 上學期 期末考試」; the same meta when the title is fine or nothing better is known.
 */
export function withExamTitle<T extends ExamMeta>(meta: T): T {
  if (!isFormName(meta.title)) return meta
  const parts = [meta.subject, meta.term].map((p) => p?.trim()).filter((p): p is string => Boolean(p))
  if (parts.length === 0) return meta
  return { ...meta, title: parts.join(' ') }
}
