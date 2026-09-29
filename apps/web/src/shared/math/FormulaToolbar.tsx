'use client'

import type { MathfieldElement } from 'mathlive'
import { useState } from 'react'
import { IconCheck, IconCode, IconTrash } from '@/shared/icons'

/** Common structures, inserted at the cursor; #0 is the selection and #? an empty slot. */
const TEMPLATES: { label: string; latex: string; insert: string }[] = [
  { label: '分數', latex: '\\frac{a}{b}', insert: '\\frac{#0}{#?}' },
  { label: 'xⁿ', latex: 'x^{n}', insert: '#0^{#?}' },
  { label: 'xₙ', latex: 'x_{n}', insert: '#0_{#?}' },
  { label: '√', latex: '\\sqrt{x}', insert: '\\sqrt{#0}' },
  { label: 'ⁿ√', latex: '\\sqrt[n]{x}', insert: '\\sqrt[#?]{#0}' },
  { label: 'lim', latex: '\\lim_{x\\to a}', insert: '\\lim_{#?\\to #?}' },
  { label: '∫', latex: '\\int_a^b', insert: '\\int_{#?}^{#?}#0\\,d#?' },
  { label: 'Σ', latex: '\\sum', insert: '\\sum_{#?}^{#?}' },
  { label: '|x|', latex: '|x|', insert: '\\left|#0\\right|' },
  { label: 'v⃗', latex: '\\vec{v}', insert: '\\vec{#0}' },
  { label: 'H₂O', latex: '\\ce{H2O}', insert: '\\ce{#0}' },
  { label: '±', latex: '\\pm', insert: '\\pm' },
  { label: '≤', latex: '\\le', insert: '\\le' },
  { label: '≥', latex: '\\ge', insert: '\\ge' },
  { label: '≠', latex: '\\ne', insert: '\\ne' },
  { label: '∞', latex: '\\infty', insert: '\\infty' },
  { label: 'π', latex: '\\pi', insert: '\\pi' },
  { label: 'θ', latex: '\\theta', insert: '\\theta' },
  { label: '→', latex: '\\to', insert: '\\to' },
  { label: '°', latex: '^{\\circ}', insert: '^{\\circ}' },
]

/**
 * Tools for the formula being edited in place: shapes to insert, the LaTeX behind it,
 * remove and done. It sits at the bottom of the text box; its buttons keep the focus in the formula.
 */
export function FormulaToolbar({ field, onDone, onRemove, onSource }: { field: MathfieldElement; onDone: () => void; onRemove: () => void; onSource: (latex: string) => void }) {
  const [source, setSource] = useState<string | null>(null)
  const keep = (e: React.MouseEvent) => e.preventDefault()
  const insert = (template: string) => {
    field.executeCommand(['insert', template, { selectionMode: 'placeholder' }])
    field.focus()
  }
  const tool = 'm-press h-7 min-w-7 shrink-0 rounded-md px-1.5 text-[13px] text-ink/80 hover:bg-accent-soft hover:text-accent'
  return (
    <div className="m-expand border-t border-line/70 bg-paper/60 px-2 py-1.5" data-formula-toolbar>
      <div className="flex items-center gap-1">
        <div className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto" role="toolbar" aria-label="插入公式符號">
          {TEMPLATES.map((t) => (
            <button key={t.label} type="button" onMouseDown={keep} onClick={() => insert(t.insert)} className={tool} title={t.latex}>
              {t.label}
            </button>
          ))}
        </div>
        <span className="mx-0.5 h-5 w-px shrink-0 bg-line" />
        <button
          type="button"
          onMouseDown={keep}
          onClick={() => setSource(source === null ? field.value : null)}
          className={`${tool} grid place-items-center ${source !== null ? 'bg-accent-soft text-accent' : ''}`}
          aria-label="LaTeX 原始碼"
          title="LaTeX 原始碼"
        >
          <IconCode size={15} />
        </button>
        <button type="button" onMouseDown={keep} onClick={onRemove} className={`${tool} grid place-items-center hover:bg-bad-soft hover:text-bad`} aria-label="刪除公式" title="刪除公式">
          <IconTrash size={14} />
        </button>
        <button type="button" onMouseDown={keep} onClick={onDone} className="m-press grid h-7 w-7 shrink-0 place-items-center rounded-md bg-accent text-white" aria-label="公式完成" title="公式完成（Enter）">
          <IconCheck size={15} strokeWidth={2.6} />
        </button>
      </div>
      {source !== null && (
        <input
          value={source}
          onChange={(e) => {
            setSource(e.target.value)
            onSource(e.target.value)
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onDone())}
          className="mt-1.5 w-full rounded-md border border-line bg-surface px-2 py-1 font-mono text-[12px] outline-none focus:border-accent"
          aria-label="LaTeX 原始碼"
          spellCheck={false}
        />
      )}
      <p className="mt-1 px-0.5 text-[11px] text-muted">直接打字：/ 是分數、^ 是次方、sqrt 是根號，Enter 完成；平板會出現數學鍵盤。</p>
    </div>
  )
}
