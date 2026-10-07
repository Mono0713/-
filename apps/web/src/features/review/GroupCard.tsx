'use client'

import type { DraftExam, DraftQuestion } from '@exam/core'
import { useState } from 'react'
import { FigureView } from '@/shared/FigureView'
import { IconMerge } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { Markdown } from '@/shared/Markdown'
import { MathTextInput } from '@/shared/math/MathTextInput'
import { Badge } from '@/shared/ui'
import { splitNumber } from './parts'
import { sharedRule, withoutRule } from '@/shared/markingRule'

/**
 * A passage, figure or instruction shared by the questions after it, which hang under it. When they are
 * the sub-questions of one number, e.g. 11(a) and 11(b), it heads them as that question. Its text can be edited in place.
 */
export function GroupCard({
  group,
  parts,
  onChange,
  onSelect,
  onMerge,
}: {
  group: DraftExam['groups'][number]
  parts: DraftQuestion[]
  onChange: (stem: string) => void
  /** Clicking the card picks its first question, so its box shows on the page. */
  onSelect: () => void
  /** Given, the sub-questions of one number can be joined back into one question. */
  onMerge?: () => void
}) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const numbers = parts.map((p) => splitNumber(p.number))
  const main = numbers.length && numbers.every((n) => n.part !== null && n.main === numbers[0]!.main) ? numbers[0]!.main : null
  // a rule all its sub-questions share shows once here, not on each of them
  const rule = sharedRule(parts)
  const points = parts.every((p) => p.points !== null) ? parts.reduce((sum, p) => sum + p.points!, 0) : null
  return (
    <div data-group={group.id} onClick={() => !editing && onSelect()} className="relative mb-3 scroll-mt-40 rounded-2xl bg-surface/70 p-4 ring-1 ring-ink/[0.07]">
      <div className="mb-2 flex items-center gap-2">
        {main !== null ? <span className="num text-xl leading-none">{main}.</span> : <span className="text-xs font-medium text-muted">{t('題組共用內容')}</span>}
        <Badge>{main !== null ? t('{n} 小題', { n: parts.length }) : t('{n} 題', { n: parts.length })}</Badge>
        {main !== null && points !== null && <Badge>{t('{points} 分', { points: Math.round(points * 100) / 100 })}</Badge>}
        <span className="ml-auto flex items-center gap-3">
          {main !== null && onMerge && !editing && (
            <button
              type="button"
              onClick={(e) => (e.stopPropagation(), onMerge())}
              className="flex items-center gap-1 text-xs text-accent hover:underline"
              title={t('把小題合回一題')}
            >
              <IconMerge size={13} />
              {t('合併')}
            </button>
          )}
          <button type="button" onClick={(e) => (e.stopPropagation(), setEditing(!editing))} className="text-xs text-accent hover:underline">
            {editing ? t('完成') : t('編輯')}
          </button>
        </span>
      </div>
      {editing ? <MathTextInput value={group.stem} onChange={onChange} /> : group.stem.trim() ? <Markdown>{withoutRule(group.stem, rule)}</Markdown> : <p className="text-sm text-muted">{t('（沒有共用內容）')}</p>}
      {rule && !editing && (
        <p className="mt-2 text-xs text-muted">
          {t('評分規則：')}
          <span className="rounded bg-warn-soft px-1 text-ink/80">{rule}</span>
        </p>
      )}
      {group.figures.map((f, i) => (
        <FigureView key={i} figure={f} />
      ))}
    </div>
  )
}
