'use client'

import { optionFigures, type DraftQuestion } from '@exam/core'
import { useT } from '@/shared/i18n/client'
import { OptionPictures } from '@/shared/FigureView'
import { Markdown } from '@/shared/Markdown'

const ITEM = /^\s*(?:[-*]\s*)?[(（]?\d{1,2}\s*[).、．）:]/

/** A matching question's stem split into its lead-in text and the numbered items to match. */
export function matchingParts(stem: string): { lead: string; items: string[] } {
  const lines = stem.split('\n')
  const items = lines.filter((l) => ITEM.test(l)).map((l) => l.trim())
  return { lead: lines.filter((l) => !ITEM.test(l)).join('\n').trim(), items }
}

/** 配合題 laid out like the printed table: the answer, the item, and the choices side by side. */
export function MatchingTable({ q }: { q: DraftQuestion }) {
  const t = useT()
  const { lead, items } = matchingParts(q.stem)
  const rows = Math.max(items.length, q.options.length)
  const cell = 'border border-line px-2.5 py-1.5 align-top'
  return (
    <div className="space-y-2">
      {lead && <Markdown>{lead}</Markdown>}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-paper text-xs text-muted">
            <tr>
              <th className={`${cell} w-14 text-center font-medium`}>{t('配對')}</th>
              <th className={`${cell} text-left font-medium`}>{t('題目')}</th>
              <th className={`${cell} text-left font-medium`}>{t('選項')}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, i) => {
              const o = q.options[i]
              const answer = i < items.length ? q.answer.values[i]?.trim() : ''
              return (
                <tr key={i}>
                  <td className={`${cell} num text-center font-semibold ${answer ? 'bg-good-soft text-good' : ''}`}>{answer ? `(${answer})` : ''}</td>
                  <td className={cell}>{items[i] ? <Markdown>{items[i]}</Markdown> : null}</td>
                  <td className={cell}>
                    {o && (
                      <span className="flex gap-2">
                        <span className="num shrink-0 font-semibold text-muted">({o.label})</span>
                        <span className="min-w-0 flex-1">
                          <Markdown>{o.content}</Markdown>
                          <OptionPictures figures={optionFigures(q, o.label)} />
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
