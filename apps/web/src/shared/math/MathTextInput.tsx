'use client'

import katex from 'katex'
import 'katex/contrib/mhchem'
import type { MathfieldElement } from 'mathlive'
import { useRef, useState, type ReactNode } from 'react'
import { IconCode, IconFormula } from '@/shared/icons'
import { splitMath, withMathDelimiters } from './delimiters'
import { FormulaToolbar } from './FormulaToolbar'
import { loadMathLive } from './mathlive'

/**
 * Text with formulas, edited as it looks. Formulas show rendered; clicking one turns it into a
 * visual formula editor right there in the text, with its tools at the bottom of the box, so
 * nobody has to read or write LaTeX and nothing pops up. The value is still Markdown text with
 * $…$ formulas. The label and tools sit inside the box; `actions` adds controls next to them
 * (at the end of the line when there is no label row) and `prefix` goes before the text.
 * `source` switches to the raw text for things like Markdown tables.
 */
export function MathTextInput({
  value,
  onChange,
  multiline = true,
  placeholder,
  label,
  actions,
  prefix,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  placeholder?: string
  label?: string
  actions?: ReactNode
  /** Sits before the text on the same line, e.g. an option's label. */
  prefix?: ReactNode
  className?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  // The text the editor last produced; the DOM is rebuilt only when the value changes from outside.
  const shown = useRef<string | null>(null)
  const range = useRef<Range | null>(null)
  // The formula being edited, also for the editor's own event listeners.
  const editingRef = useRef<{ chip: HTMLElement; field: MathfieldElement } | null>(null)
  const [editing, setEditing] = useState<{ chip: HTMLElement; field: MathfieldElement } | null>(null)
  const [source, setSource] = useState(false)
  const latest = useRef({ value, onChange })
  latest.current = { value, onChange }

  const emit = () => {
    const el = root.current
    if (!el) return
    const text = serialize(el)
    shown.current = text
    if (text !== latest.current.value) latest.current.onChange(text)
  }

  const remember = () => {
    const sel = window.getSelection()
    if (sel?.rangeCount && root.current?.contains(sel.anchorNode)) range.current = sel.getRangeAt(0).cloneRange()
  }

  /** Ends editing: the formula shows rendered again (or goes, when emptied); the caret can move next to it. */
  const close = (place?: 'before' | 'after') => {
    const current = editingRef.current
    if (!current) return
    editingRef.current = null
    setEditing(null)
    const { chip, field } = current
    const latex = field.value.trim()
    delete chip.dataset.editing
    const el = root.current
    if (!latex) chip.remove()
    else fillChip(chip, latex, chip.dataset.display === '1')
    emit()
    if (!el || !place) return
    el.focus()
    const sel = window.getSelection()
    const r = document.createRange()
    if (chip.isConnected) place === 'after' ? r.setStartAfter(chip) : r.setStartBefore(chip)
    else r.selectNodeContents(el), r.collapse(false)
    r.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(r)
  }

  /** Turns a rendered formula into the visual editor, in place. */
  const open = async (chip: HTMLElement) => {
    if (editingRef.current?.chip === chip) return
    close()
    const Element = await loadMathLive()
    if (!chip.isConnected) return
    const field = new Element()
    field.value = chip.dataset.latex ?? ''
    field.smartFence = true
    field.mathVirtualKeyboardPolicy = 'auto'
    field.className = 'inline-formula'
    field.addEventListener('input', () => {
      chip.dataset.latex = field.value
      emit()
    })
    // Enter finishes (once the key is over, or the text box would get the Enter as a new line);
    // arrows past either end leave the formula on that side.
    field.addEventListener('change', () => setTimeout(() => editingRef.current?.field === field && close('after')))
    field.addEventListener('move-out', (e) => close((e as CustomEvent<{ direction: string }>).detail.direction === 'backward' ? 'before' : 'after'))
    field.addEventListener('keydown', (e) => e.key === 'Escape' && close('after'))
    field.addEventListener('focusout', () =>
      // Clicks on the formula tools keep it open; anything else closes it.
      setTimeout(() => {
        const active = document.activeElement
        if (editingRef.current?.field === field && active !== field && !active?.closest('[data-formula-toolbar]')) close()
      }, 0),
    )
    chip.dataset.editing = '1'
    chip.replaceChildren(field)
    editingRef.current = { chip, field }
    setEditing({ chip, field })
    requestAnimationFrame(() => field.focus())
  }

  /** A new, empty formula at the caret, opened for editing. */
  const insert = () => {
    const el = root.current
    if (!el) return
    const chip = makeChip('', false)
    const r = range.current && el.contains(range.current.startContainer) ? range.current : null
    if (r) {
      r.deleteContents()
      r.insertNode(chip)
    } else el.append(chip)
    void open(chip)
  }

  const header = Boolean(label || multiline)
  const tools = (
    <>
      {!source && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            remember()
            insert()
          }}
          className="m-press flex h-6 items-center gap-0.5 rounded-md px-1.5 text-xs text-accent hover:bg-accent-soft"
          title="插入公式"
          aria-label="插入公式"
        >
          <IconFormula size={13} strokeWidth={2.4} />
          {header && '公式'}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          close()
          // The rich view is created again and must be filled from the value.
          shown.current = null
          setSource(!source)
        }}
        className={`m-press grid h-6 w-6 place-items-center rounded-md ${source ? 'bg-ink/[0.06] text-ink' : 'text-muted hover:bg-ink/[0.05] hover:text-ink'}`}
        title={source ? '回到一般編輯' : '直接編輯文字與 LaTeX'}
        aria-label={source ? '回到一般編輯' : '原始碼'}
        aria-pressed={source}
      >
        <IconCode size={14} />
      </button>
    </>
  )

  return (
    <div
      className={`group/field overflow-hidden rounded-xl border bg-surface text-sm transition-[border-color,box-shadow] ${
        editing ? 'border-accent ring-[3px] ring-accent/15' : 'border-line focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/15'
      } ${className}`}
    >
      {header && (
        <div className="flex h-8 items-center gap-1 pl-3 pr-1.5 pt-1">
          {label && <span className="text-[11px] font-medium tracking-wide text-muted">{label}</span>}
          <div className="ml-auto flex items-center gap-0.5">
            <div className="flex items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-hover/field:opacity-100 sm:group-focus-within/field:opacity-100">{tools}</div>
            {actions}
          </div>
        </div>
      )}
      <div className="relative flex items-start">
        {prefix && <div className="flex shrink-0 items-center self-stretch pl-1.5">{prefix}</div>}
        {source ? (
          <textarea
            autoComplete="off"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={multiline ? Math.max(2, Math.min(20, value.split('\n').length + 1)) : 1}
            className={`min-w-0 flex-1 resize-none bg-transparent px-3 font-mono text-[13px] outline-none ${header ? 'pb-2.5 pt-0.5' : 'py-2'}`}
            aria-label={label}
            spellCheck={false}
          />
        ) : (
          <>
            <div className="relative min-w-0 flex-1">
              <div
                ref={(el) => {
                  root.current = el
                  // Runs on every render: rebuild only when the value was changed from outside
                  // (or after the source view), so typing never moves the cursor.
                  if (el && shown.current !== value) {
                    if (editingRef.current) {
                      editingRef.current = null
                      setEditing(null)
                    }
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
                  // Enter in the formula editor finishes the formula and adds no line.
                  if ((e.target as HTMLElement).closest('math-field')) return
                  if (multiline) document.execCommand('insertLineBreak')
                }}
                onPaste={(e) => {
                  e.preventDefault()
                  document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
                }}
                onClick={(e) => {
                  const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-latex]')
                  if (chip && root.current?.contains(chip)) void open(chip)
                }}
                className={`whitespace-pre-wrap break-words ${prefix ? 'px-2' : 'px-3'} leading-relaxed outline-none [&_[data-latex]]:mx-0.5 [&_[data-latex]]:cursor-pointer [&_[data-latex]]:rounded [&_[data-latex]]:px-0.5 [&_[data-latex]:hover]:bg-accent-soft [&_[data-editing]]:bg-accent-soft [&_[data-editing]]:ring-1 [&_[data-editing]]:ring-accent/40 ${
                  header ? 'pb-2.5 pt-0.5' : 'py-2'
                } ${multiline ? 'min-h-14' : ''}`}
              />
              {!value && !editing && placeholder && (
                <span className={`pointer-events-none absolute text-muted ${prefix ? 'left-2' : 'left-3'} ${header ? 'top-0.5' : 'top-2'}`}>{placeholder}</span>
              )}
            </div>
            {!header && (
              <div className="flex shrink-0 items-center gap-0.5 self-center pr-1">
                {/* One-line boxes keep their width for text: the tools show while the box is in use. */}
                <div className="hidden items-center gap-0.5 group-focus-within/field:flex sm:group-hover/field:flex">{tools}</div>
                {actions}
              </div>
            )}
          </>
        )}
      </div>
      {editing && (
        <FormulaToolbar
          key={editing.chip.dataset.latex === '' ? 'new' : 'edit'}
          field={editing.field}
          onDone={() => close('after')}
          onRemove={() => {
            editing.field.value = ''
            close('after')
          }}
          onSource={(latex) => {
            editing.field.value = latex
            editing.chip.dataset.latex = latex
            emit()
          }}
        />
      )}
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
      out += (node.nodeValue ?? '').replace(/ /g, ' ')
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.dataset.latex !== undefined) {
      // A formula emptied while editing leaves nothing behind.
      if (node.dataset.latex.trim()) out += node.dataset.display === '1' ? `$$${node.dataset.latex}$$` : `$${node.dataset.latex}$`
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
