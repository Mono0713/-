'use client'

import type { MathfieldElement } from 'mathlive'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/shared/ui'
import { MathField } from './MathField'

/** Common structures, inserted at the cursor; #0 is the selection and #? an empty slot. */
const TEMPLATES: { label: string; latex: string; insert: string }[] = [
  { label: '分數', latex: '\\frac{a}{b}', insert: '\\frac{#0}{#?}' },
  { label: '次方', latex: 'x^{n}', insert: '#0^{#?}' },
  { label: '下標', latex: 'x_{n}', insert: '#0_{#?}' },
  { label: '根號', latex: '\\sqrt{x}', insert: '\\sqrt{#0}' },
  { label: 'n 次方根', latex: '\\sqrt[n]{x}', insert: '\\sqrt[#?]{#0}' },
  { label: '極限', latex: '\\lim_{x\\to a}', insert: '\\lim_{#?\\to #?}' },
  { label: '積分', latex: '\\int_a^b', insert: '\\int_{#?}^{#?}#0\\,d#?' },
  { label: '總和', latex: '\\sum', insert: '\\sum_{#?}^{#?}' },
  { label: '絕對值', latex: '|x|', insert: '\\left|#0\\right|' },
  { label: '向量', latex: '\\vec{v}', insert: '\\vec{#0}' },
  { label: '化學式', latex: '\\ce{H2O}', insert: '\\ce{#0}' },
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
 * Edits one formula in a pop-up. Returns the new LaTeX, or null when the formula is removed.
 * Typing works as on a calculator: "/" makes a fraction, "^" a power, "sqrt" a root.
 */
export function FormulaDialog({
  initial,
  onDone,
  onCancel,
  canRemove,
}: {
  initial: string
  onDone: (latex: string | null) => void
  onCancel: () => void
  canRemove: boolean
}) {
  const [latex, setLatex] = useState(initial)
  const [showSource, setShowSource] = useState(false)
  const field = useRef<MathfieldElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const insert = (template: string) => {
    const mf = field.current
    if (!mf) return
    mf.executeCommand(['insert', template, { selectionMode: 'placeholder' }])
    mf.focus()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-night/40 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div role="dialog" aria-label="編輯公式" className="m-enter w-full max-w-xl space-y-3 rounded-2xl bg-surface p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="font-semibold">編輯公式</p>
          <button type="button" onClick={() => setShowSource(!showSource)} className="text-xs text-muted hover:text-ink">
            {showSource ? '隱藏原始碼' : 'LaTeX 原始碼'}
          </button>
        </div>
        <MathField value={latex} onChange={setLatex} onReady={(mf) => (field.current = mf)} autoFocus />
        <div className="flex flex-wrap gap-1">
          {TEMPLATES.map((t) => (
            <button key={t.label} type="button" onClick={() => insert(t.insert)} className="m-press rounded-md bg-paper px-2 py-1 text-xs text-ink hover:bg-accent-soft" title={t.latex}>
              {t.label}
            </button>
          ))}
        </div>
        {showSource && (
          <input value={latex} onChange={(e) => setLatex(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[13px]" aria-label="LaTeX 原始碼" />
        )}
        <p className="text-xs text-muted">直接打字：「/」是分數、「^」是次方、「sqrt」是根號；平板會出現數學鍵盤。</p>
        <div className="flex items-center gap-2">
          {canRemove && (
            <Button variant="danger" onClick={() => onDone(null)}>
              刪除公式
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button onClick={onCancel}>取消</Button>
            <Button variant="primary" onClick={() => onDone(latex.trim() || null)}>
              完成
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
