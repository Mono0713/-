import type { Option } from '@exam/core'
import { Markdown } from './Markdown'

/**
 * The word box of a 選詞填空 printed once above its sentences, framed like on paper: each word with its
 * label, flowing into as many columns as fit, so ten words take two lines on a computer and stay readable on a phone.
 * Unframed on the printed sheet, whose passage box already frames it.
 */
export function WordBox({ options, className = '', framed = true }: { options: Option[]; className?: string; framed?: boolean }) {
  return (
    <ul className={`grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-x-4 gap-y-1 ${framed ? 'rounded-lg border border-line bg-surface px-3 py-2 text-sm' : ''} ${className}`}>
      {options.map((o, i) => (
        <li key={`${o.label}-${i}`} className="flex min-w-0 gap-1.5">
          <span className="num shrink-0 font-semibold leading-relaxed text-muted">{o.label}</span>
          <Markdown className="min-w-0 [overflow-wrap:anywhere]">{o.content}</Markdown>
        </li>
      ))}
    </ul>
  )
}
