import katex from 'katex'
import 'katex/contrib/mhchem'
import { splitMath } from './delimiters'

// The text box's content as DOM: text, <br> line breaks and formula chips (a rendered formula
// holding its LaTeX in data-latex). `chipTitle` is the tooltip on each formula (translated by the caller).

export function render(el: HTMLElement, text: string, chipTitle: string) {
  el.replaceChildren()
  fill(el, splitMath(text), chipTitle)
  // A trailing line break needs one more <br> to show as an empty line (serialize drops it).
  if (text.endsWith('\n')) el.append(document.createElement('br'))
}

/** Text runs, line breaks and formulas, appended in order. */
export function fill(el: ParentNode, segments: ReturnType<typeof splitMath>, chipTitle: string) {
  for (const seg of segments) {
    if (seg.kind === 'math') el.append(makeChip(seg.latex, seg.display, chipTitle))
    else
      seg.text.split('\n').forEach((line, i) => {
        if (i > 0) el.append(document.createElement('br'))
        if (line) el.append(document.createTextNode(line))
      })
  }
}

/** The formula a node sits in, if any. */
export function chipOf(node: Node): HTMLElement | null {
  const el = node instanceof HTMLElement ? node : node.parentElement
  return el?.closest<HTMLElement>('[data-latex]') ?? null
}

export function makeChip(latex: string, display: boolean, title: string): HTMLElement {
  const chip = document.createElement('span')
  chip.contentEditable = 'false'
  fillChip(chip, latex, display, title)
  return chip
}

export function fillChip(chip: HTMLElement, latex: string, display: boolean, title: string) {
  chip.dataset.latex = latex
  chip.dataset.display = display ? '1' : '0'
  chip.title = title
  chip.innerHTML = katex.renderToString(latex, { throwOnError: false, strict: false, displayMode: false })
}

/** Turns the edited DOM back into text with $…$ formulas. */
export function serialize(el: HTMLElement): string {
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
