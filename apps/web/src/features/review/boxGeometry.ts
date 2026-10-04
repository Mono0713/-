import type { DraftQuestion } from '@exam/core'

// A question's box on its page, as fractions of the page, and how dragging a grip changes it.

export type Box = DraftQuestion['locations'][number]['bbox']
/** What a press on the selected box changes: the whole box, or the edges named (n s e w). */
export type Grip = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
export const GRIPS: { grip: Grip; className: string }[] = [
  // edges: a 12px band centred on the outline, so a press meant to resize never moves the box
  { grip: 'n', className: '-top-1.5 inset-x-2 h-3 cursor-ns-resize' },
  { grip: 's', className: '-bottom-1.5 inset-x-2 h-3 cursor-ns-resize' },
  { grip: 'w', className: '-left-1.5 inset-y-2 w-3 cursor-ew-resize' },
  { grip: 'e', className: '-right-1.5 inset-y-2 w-3 cursor-ew-resize' },
  // corners: an invisible 14px target
  { grip: 'nw', className: '-left-[7px] -top-[7px] cursor-nwse-resize' },
  { grip: 'ne', className: '-right-[7px] -top-[7px] cursor-nesw-resize' },
  { grip: 'sw', className: '-bottom-[7px] -left-[7px] cursor-nesw-resize' },
  { grip: 'se', className: '-bottom-[7px] -right-[7px] cursor-nwse-resize' },
]
const MIN = 0.012
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** The box after a grip moved by (dx, dy), as fractions of the page; it never leaves the page or turns inside out. */
export function dragged(b: Box, grip: Grip, dx: number, dy: number): Box {
  if (grip === 'move') return { ...b, x: clamp(b.x + dx, 0, 1 - b.width), y: clamp(b.y + dy, 0, 1 - b.height) }
  let { x, y } = b
  let right = b.x + b.width
  let bottom = b.y + b.height
  if (grip.includes('n')) y = clamp(y + dy, 0, bottom - MIN)
  if (grip.includes('s')) bottom = clamp(bottom + dy, y + MIN, 1)
  if (grip.includes('w')) x = clamp(x + dx, 0, right - MIN)
  if (grip.includes('e')) right = clamp(right + dx, x + MIN, 1)
  return { x, y, width: right - x, height: bottom - y }
}
