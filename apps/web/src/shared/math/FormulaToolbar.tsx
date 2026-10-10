'use client'

import katex from 'katex'
import 'katex/contrib/mhchem'
import type { MathfieldElement } from 'mathlive'
import { useEffect, useMemo, useState } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconCheck, IconTrash } from '@/shared/icons'
import { FORMULA_GROUPS } from './formulaKeys'
import { plain } from './mathlive'
import { touchQuery } from './mathKeyboard'

const LATEX_TAB = 'latex'
// The group last used stays open for the next formula.
let lastTab = FORMULA_GROUPS[0]!.id

/**
 * Tools for the formula being edited in place, at the bottom of its text box: groups of keys
 * that look like what they insert (common, algebra, geometry, calculus, Greek, chemistry), a
 * LaTeX tab with the formula's source, remove and done. Its buttons keep the focus in the formula.
 */
export function FormulaToolbar({ field, onDone, onRemove, onSource }: { field: MathfieldElement; onDone: () => void; onRemove: () => void; onSource: (latex: string) => void }) {
  const t = useT()
  // On touch screens the keys are on the on-screen math keyboard; the box keeps LaTeX, remove and done.
  const [touch] = useState(() => window.matchMedia(touchQuery).matches)
  const [tab, setTab] = useState(touch ? '' : lastTab)
  const [source, setSource] = useState(() => plain(field))
  const group = FORMULA_GROUPS.find((g) => g.id === tab)
  const keys = useMemo(
    () => group?.keys.map((key) => ({ ...key, html: katex.renderToString(key.show, { throwOnError: false, strict: false }) })) ?? [],
    [group],
  )

  // The LaTeX tab follows what is typed in the formula itself.
  useEffect(() => {
    const sync = () => setSource(plain(field))
    field.addEventListener('input', sync)
    return () => field.removeEventListener('input', sync)
  }, [field])

  const keep = (e: React.MouseEvent) => e.preventDefault()
  const choose = (id: string) => {
    if (touch && id === tab) return setTab('')
    setTab(id)
    if (id !== LATEX_TAB) lastTab = id
    else setSource(plain(field))
  }
  const insert = (template: string) => {
    field.executeCommand(['insert', template, { selectionMode: 'placeholder' }])
    field.focus()
  }
  const tabClass = (active: boolean) =>
    `relative h-8 shrink-0 px-2 text-[12.5px] transition-colors ${active ? 'font-medium text-ink' : 'text-muted hover:text-ink'} after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent ${active ? 'after:opacity-100' : 'after:opacity-0'}`

  return (
    <div className="m-expand border-t border-line/70 bg-paper/60" data-formula-toolbar>
      <div className={`flex items-center gap-1 pl-1.5 pr-1.5 ${tab ? 'border-b border-line/50' : 'py-1'}`}>
        <div className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label={t('插入公式符號')}>
          {!touch && FORMULA_GROUPS.map((g) => (
            <button key={g.id} type="button" role="tab" aria-selected={tab === g.id} onMouseDown={keep} onClick={() => choose(g.id)} className={tabClass(tab === g.id)}>
              {t(g.label)}
            </button>
          ))}
          <button type="button" role="tab" aria-selected={tab === LATEX_TAB} onMouseDown={keep} onClick={() => choose(LATEX_TAB)} className={`${tabClass(tab === LATEX_TAB)} font-mono !text-[12px]`}>
            LaTeX
          </button>
        </div>
        <button
          type="button"
          onMouseDown={keep}
          onClick={onRemove}
          className="m-press grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-bad-soft hover:text-bad"
          aria-label={t('刪除公式')}
          title={t('刪除公式')}
        >
          <IconTrash size={14} />
        </button>
        <button
          type="button"
          onMouseDown={keep}
          onClick={onDone}
          className="m-press flex h-7 shrink-0 items-center gap-1 rounded-md bg-accent pl-1.5 pr-2.5 text-xs font-medium text-on-accent"
          title={t('公式完成（Enter）')}
        >
          <IconCheck size={14} strokeWidth={2.6} />
          {t('完成')}
        </button>
      </div>

      {tab === LATEX_TAB && (
        <div className="px-2 py-2">
          <textarea
            autoComplete="off"
            value={source}
            rows={Math.min(4, Math.max(1, Math.ceil(source.length / 60)))}
            onChange={(e) => {
              setSource(e.target.value)
              onSource(e.target.value)
            }}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onDone())}
            className="block w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-[12.5px] leading-relaxed outline-none focus:border-accent"
            aria-label={t('LaTeX 原始碼')}
            placeholder="\frac{a}{b}"
            spellCheck={false}
          />
        </div>
      )}
      {group && (
        <div key={tab} className="flex flex-wrap gap-0.5 px-1.5 py-1.5" role="toolbar" aria-label={t(group!.label)}>
          {keys.map((key) => (
            <button
              key={key.show}
              type="button"
              onMouseDown={keep}
              onClick={() => insert(key.insert)}
              className="m-press grid h-10 min-w-10 place-items-center rounded-lg px-1.5 text-[15px] text-ink/85 hover:bg-accent-soft hover:text-accent [&_.katex]:text-[1em]"
              title={key.insert.replace(/#0|#\?/g, '□')}
              aria-label={key.insert.replace(/#0|#\?/g, '□')}
              dangerouslySetInnerHTML={{ __html: key.html }}
            />
          ))}
        </div>
      )}

      {!touch && <p className="px-3 pb-1.5 text-[11px] text-muted">{t('也可以直接打：/ 分數、^ 次方、_ 下標、sqrt 根號；Enter 完成')}</p>}
    </div>
  )
}
