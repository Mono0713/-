'use client'

import { useEffect, useRef, useState } from 'react'
import type { MathfieldElement } from 'mathlive'

let loading: Promise<typeof MathfieldElement> | null = null

/** Loads the formula editor once, in the browser only. */
function loadMathLive() {
  loading ??= import('mathlive').then(({ MathfieldElement }) => {
    MathfieldElement.fontsDirectory = '/mathlive/fonts'
    MathfieldElement.soundsDirectory = null
    return MathfieldElement
  })
  return loading
}

/**
 * A visual formula editor (MathLive): type or tap to build a formula, no LaTeX needed.
 * On tablets it opens a maths keyboard. `value` and `onChange` are LaTeX.
 */
export function MathField({
  value,
  onChange,
  onReady,
  autoFocus = false,
  className = '',
}: {
  value: string
  onChange: (latex: string) => void
  onReady?: (field: MathfieldElement) => void
  autoFocus?: boolean
  className?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const field = useRef<MathfieldElement | null>(null)
  const changed = useRef(onChange)
  changed.current = onChange
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadMathLive().then((Element) => {
      if (cancelled || !host.current) return
      const mf = new Element()
      mf.value = value
      mf.smartFence = true
      mf.mathVirtualKeyboardPolicy = 'auto'
      mf.addEventListener('input', () => changed.current(mf.value))
      mf.style.width = '100%'
      // The surrounding box draws the border and focus ring.
      mf.style.border = 'none'
      mf.style.outline = 'none'
      mf.style.background = 'transparent'
      host.current.replaceChildren(mf)
      field.current = mf
      setReady(true)
      onReady?.(mf)
      if (autoFocus) requestAnimationFrame(() => mf.focus())
    })
    return () => {
      cancelled = true
    }
    // The field is created once; later values are pushed in below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const mf = field.current
    if (mf && mf.value !== value) mf.value = value
  }, [value])

  return (
    <div className={`relative min-h-12 rounded-lg border border-line bg-surface px-2 py-1.5 text-xl focus-within:border-accent ${className}`}>
      {/* The editor goes into its own element, which React leaves alone. */}
      <div ref={host} />
      {!ready && <span className="absolute left-2 top-3 text-sm text-muted">載入公式編輯器…</span>}
    </div>
  )
}
