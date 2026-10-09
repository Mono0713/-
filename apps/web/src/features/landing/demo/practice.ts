import type { T } from '@/shared/i18n/format'
import { SAMPLES } from '../samples'
import { sayWith } from '../sheet/parts'

/** The question the tour practises on the phone: printed in one language, read in the visitor's. */
export interface PracticeItem {
  text: string
  code?: string
  options: string[]
  answer: number
  /** The visitor's language, or null when the question reads the same (an English or Japanese exam). */
  read: { text: string; options: string[] } | null
  why: string
}

/**
 * Each sample's first choice question, worked out on the server where both languages are at hand
 * (`printed` is the other one, as on the 試一題 card). A sample without one has no entry.
 */
export function practiceItems(t: T, printed: T): Record<string, PracticeItem> {
  const say = sayWith(t)
  const sayPrinted = sayWith(printed)
  const items: Record<string, PracticeItem> = {}
  for (const sample of SAMPLES) {
    const q = sample.questions.find((q) => q.kind === 'choice')
    if (q?.kind !== 'choice') continue
    const text = sayPrinted(q.text)
    const options = q.options.map(sayPrinted)
    const read = { text: say(q.text), options: q.options.map(say) }
    const same = read.text === text && read.options.every((o, i) => o === options[i])
    items[sample.id] = { text, code: q.code, options, answer: q.answer, read: same ? null : read, why: say(q.why) }
  }
  return items
}
