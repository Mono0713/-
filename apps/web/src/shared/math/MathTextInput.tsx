'use client'

import katex from 'katex'
import 'katex/contrib/mhchem'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { splitMath, withMathDelimiters } from './delimiters'
import { FormulaDialog } from './FormulaDialog'

/**
 * Text with formulas, edited as it looks: formulas show rendered and open a visual
 * editor when clicked, so nobody has to read or write LaTeX. The value is still
 * Markdown text with $…$ formulas, so it is stored and shown like before.
 * `source` switches to the raw text for things like Markdown tables.
 */
export function MathTextInput({
  value,
  onChange,
  multiline = true,
  placeholder,
  label,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  placeholder?: string
  label?: string
  className?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  // The text the editor last produced; the DOM is rebuilt only when the value changes from outside.
  const shown = useRef<string | null>(null)
  const range = useRef<Range | null>(null)
  const [dialog, setDialog] = useState<{ chip: HTMLElement | null; latex: string } | null>(null)
  const [source, setSource] = useState(false)

  const emit = () => {
    const el = root.current
    if (!el) return
    const text = serialize(el)
    shown.current = text
    if (text !== value) onChange(text)
  }

  const remember = () => {
    const sel = window.getSelection()
    if (sel?.rangeCount && root.current?.contains(sel.anchorNode)) range.current = sel.getRangeAt(0).cloneRange()
  }

  const finish = (latex: string | null) => {
    const el = root.current
    const target = dialog
    setDialog(null)
    if (!el || !target) return
    if (target.chip) {
      if (latex === null) target.chip.remove()
      else fillChip(target.chip, latex, target.chip.dataset.display === '1')
    } else if (latex !== null) {
      const chip = makeChip(latex, false)
      const r = range.current && el.contains(range.current.startContainer) ? range.current : null
      if (r) {
        r.deleteContents()
        r.insertNode(chip)
        r.setStartAfter(chip)
        r.collapse(true)
      } else el.append(chip)
    }
    emit()
    el.focus()
  }

  return (
    <div className={`text-sm ${className}`}>
      {(label || multiline) && (
        <div className="mb-1 flex items-center justify-between gap-2">
          {label ? <span className="text-xs font-medium text-muted">{label}</span> : <span />}
          <div className="flex gap-0.5">
            {!source && multiline && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  remember()
                  setDialog({ chip: null, latex: '' })
                }}
                className="rounded px-2 py-0.5 text-xs text-accent hover:bg-accent-soft"
              >
                ＋ 公式
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                // The rich view is created again and must be filled from the value.
                shown.current = null
                setSource(!source)
              }}
              className="rounded px-2 py-0.5 text-xs text-muted hover:text-ink" title="直接編輯文字與 LaTeX">
              {source ? '一般編輯' : '原始碼'}
            </button>
          </div>
        </div>
      )}
      <div className="relative flex items-start gap-1">
        {source ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={multiline ? Math.max(2, Math.min(20, value.split('\n').length + 1)) : 1}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[13px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            aria-label={label}
          />
        ) : (
          <>
            <div
              ref={(el) => {
                root.current = el
                // Runs on every render: rebuild only when the value was changed from outside
                // (or after the source view), so typing never moves the cursor.
                if (el && shown.current !== value) {
                  render(el, withMathDelimiters(value))
                  shown.current = value
                }
              }}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline={multiline}
              aria-label={label}
              onInput={emit}
              onKeyUp={remember}
              onMouseUp={remember}
              onBlur={remember}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (multiline) document.execCommand('insertLineBreak')
              }}
              onPaste={(e) => {
                e.preventDefault()
                document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
              }}
              onClick={(e) => {
                const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-latex]')
                if (chip) setDialog({ chip, latex: chip.dataset.latex ?? '' })
              }}
              className={`min-w-0 flex-1 whitespace-pre-wrap break-words rounded-lg border border-line bg-surface px-3 py-2 leading-relaxed outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 [&_[data-latex]]:mx-0.5 [&_[data-latex]]:cursor-pointer [&_[data-latex]]:rounded [&_[data-latex]]:px-0.5 [&_[data-latex]:hover]:bg-accent-soft ${
                multiline ? 'min-h-16' : ''
              }`}
            />
            {!value && placeholder && <span className="pointer-events-none absolute left-3 top-2 text-muted">{placeholder}</span>}
            {!multiline && !source && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  remember()
                  setDialog({ chip: null, latex: '' })
                }}
                className="shrink-0 self-center rounded-md px-1.5 py-1 text-xs text-accent hover:bg-accent-soft"
                title="插入公式"
                aria-label="插入公式"
              >
                ∑
              </button>
            )}
          </>
        )}
      </div>
      {/* On top of everything, whatever card or transformed list the input sits in. */}
      {dialog && createPortal(<FormulaDialog initial={dialog.latex} canRemove={dialog.chip !== null} onCancel={() => setDialog(null)} onDone={finish} />, document.body)}
    </div>
  )
}

function render(el: HTMLElement, text: string) {
  el.replaceChildren()
  for (const seg of splitMath(text)) {
    if (seg.kind === 'math') el.append(makeChip(seg.latex, seg.display))
    else
      seg.text.split('\n').forEach((line, i) => {
        if (i > 0) el.append(document.createElement('br'))
        if (line) el.append(document.createTextNode(line))
      })
  }
  // A trailing line break needs one more <br> to show as an empty line (serialize drops it).
  if (text.endsWith('\n')) el.append(document.createElement('br'))
}

function makeChip(latex: string, display: boolean): HTMLElement {
  const chip = document.createElement('span')
  chip.contentEditable = 'false'
  fillChip(chip, latex, display)
  return chip
}

function fillChip(chip: HTMLElement, latex: string, display: boolean) {
  chip.dataset.latex = latex
  chip.dataset.display = display ? '1' : '0'
  chip.title = '點一下編輯公式'
  chip.innerHTML = katex.renderToString(latex, { throwOnError: false, strict: false, displayMode: false })
}

/** Turns the edited DOM back into text with $…$ formulas. */
function serialize(el: HTMLElement): string {
  let out = ''
  const walk = (node: Node, first: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += (node.nodeValue ?? '').replace(/ /g, ' ')
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.dataset.latex !== undefined) {
      out += node.dataset.display === '1' ? `$$${node.dataset.latex}$$` : `$${node.dataset.latex}$`
      return
    }
    if (node.tagName === 'BR') {
      out += '\n'
      return
    }
    // Some browsers wrap new lines in <div>s instead of inserting <br>s.
    const block = node.tagName === 'DIV' || node.tagName === 'P'
    if (block && !first && !out.endsWith('\n')) out += '\n'
    node.childNodes.forEach((child, i) => walk(child, i === 0))
  }
  el.childNodes.forEach((child, i) => walk(child, i === 0))
  // A last <br> only makes the line before it visible; it is not an extra line.
  return el.lastChild?.nodeName === 'BR' ? out.replace(/\n$/, '') : out
}
