'use client'

import type { QuizItem } from '@exam/quiz'
import { useState } from 'react'
import { FigureView } from '@/shared/FigureView'
import { useT } from '@/shared/i18n/client'
import { Markdown } from '@/shared/Markdown'
import { WordBox } from '@/shared/WordBox'

/** Passages folded away in this visit, so moving to the next question of the same passage keeps it folded. */
const folded = new Set<string>()

/**
 * The passage, data or figure several questions share (閱讀題組). It names the questions that share it,
 * scrolls inside itself when long so the question below stays near, and can be folded away.
 * A word box (選詞填空) shows here too, once for all the sentences that pick from it.
 */
export function Passage({ group, range }: { group: NonNullable<QuizItem['group']>; range: [number, number] | null }) {
  const t = useT()
  const [isFolded, setFolded] = useState(() => folded.has(group.stem))
  const fold = (on: boolean) => {
    if (on) folded.add(group.stem)
    else folded.delete(group.stem)
    setFolded(on)
  }
  // sub-questions grouped without shared text (1(1), 1(2)) have nothing to show above them
  if (!group.stem.trim() && !group.figures.length && !group.options?.length) return null
  const title = range ? t('第 {from}–{to} 題共用', { from: range[0] + 1, to: range[1] + 1 }) : null

  return (
    <div className="rounded-lg border border-line bg-paper">
      {(title || group.stem.length > 300) && (
        <div className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-xs text-muted">
          {title && <span>{title}</span>}
          <button type="button" onClick={() => fold(!isFolded)} aria-expanded={!isFolded} className="m-press ml-auto rounded-md px-2 py-0.5 hover:bg-ink/[0.06] hover:text-ink">
            {group.options?.length ? (isFolded ? t('展開字庫') : t('收合字庫')) : isFolded ? t('展開文章') : t('收合文章')}
          </button>
        </div>
      )}
      {!isFolded && (
        <div className="max-h-[45vh] overflow-y-auto p-3">
          {group.stem.trim() && <Markdown>{group.stem}</Markdown>}
          {group.options?.length ? <WordBox options={group.options} framed={false} className={group.stem.trim() ? 'mt-2' : ''} /> : null}
          {group.figures.map((f, i) => (
            <FigureView key={i} figure={f} />
          ))}
        </div>
      )}
    </div>
  )
}
