import type { VirtualKeyboardLayout } from 'mathlive'
import { FORMULA_GROUPS } from './formulaKeys'

/** Phones and tablets: the formula keys come in the on-screen math keyboard instead of the text box. */
export const touchQuery = '(pointer: coarse)'

const TALL = /\\(int|sum|prod|lim|begin|dbinom|sqrt\[|xrightarrow|overset)/

let configuredFor: string | null = null

/**
 * The on-screen math keyboard on touch screens: numbers first, then the same groups as the
 * formula tools on a computer, then letters. Every group has three rows of keys and one of
 * arrows, so switching groups never changes the keyboard's height.
 * `label` translates a group's name; the keyboard is set up again when the language changes.
 */
export function configureKeyboard(label: (text: string) => string) {
  const kb = window.mathVirtualKeyboard
  const lang = document.documentElement.lang
  if (!kb || configuredFor === lang) return
  configuredFor = lang
  const groups = FORMULA_GROUPS.map((group): VirtualKeyboardLayout => {
    const perRow = Math.max(6, Math.ceil(group.keys.length / 3))
    // Tall shapes (fractions, integrals, matrices) get a smaller label so they fit their key.
    const keys = group.keys.map((key) => ({ latex: key.show.replace('\\dfrac', '\\frac'), insert: key.insert, class: TALL.test(key.show) ? 'small' : '' }))
    const row = (i: number) => {
      const part = keys.slice(i * perRow, (i + 1) * perRow)
      return part.length ? part : ['[separator]']
    }
    return {
      id: `sheetloop-${group.id}`,
      label: label(group.label),
      rows: [row(0), row(1), row(2), ['[left]', '[right]', '[separator]', '[backspace]', '[hide-keyboard]']],
    }
  })
  kb.layouts = ['numeric', ...groups, 'alphabetic']
}


/**
 * While the on-screen math keyboard is up, keeps `el` (the text box being edited) in sight above
 * it: the page scrolls up, with room added at the bottom so even the last box can. Returns the undo.
 */
export function keepAboveKeyboard(el: HTMLElement): () => void {
  const kb = window.mathVirtualKeyboard
  if (!kb) return () => {}
  const scroller = scrollParent(el)
  // The page itself already gets that room from the keyboard; a scrolling panel inside it does not.
  const pad = scroller !== document.scrollingElement
  const original = scroller.style.paddingBottom
  const fit = () => {
    if (!kb.visible || !el.isConnected) {
      scroller.style.paddingBottom = original
      return
    }
    // Where the keyboard ends up: it slides in, so its rectangle mid-way is not the place.
    const height = kb.boundingRect.height
    if (!height) return
    const top = (window.visualViewport?.height ?? window.innerHeight) - height
    if (pad) scroller.style.paddingBottom = `${height}px`
    const box = el.getBoundingClientRect()
    const hidden = box.bottom + 12 - top
    // Never past the box's own top: a tall box shows from its start.
    const room = box.top - (scroller === document.scrollingElement ? 72 : scroller.getBoundingClientRect().top + 8)
    if (hidden > 0) scroller.scrollBy({ top: Math.min(hidden, Math.max(0, room)), behavior: 'smooth' })
  }
  // Again once the box's own tools have opened under the formula.
  const later = () => setTimeout(fit, 250)
  kb.addEventListener('geometrychange', fit)
  kb.addEventListener('virtual-keyboard-toggle', later)
  fit()
  return () => {
    kb.removeEventListener('geometrychange', fit)
    kb.removeEventListener('virtual-keyboard-toggle', later)
    scroller.style.paddingBottom = original
  }
}

function scrollParent(el: HTMLElement): HTMLElement {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement
}
