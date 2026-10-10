/**
 * The paper under the ink: dots (the default), ruled lines, manuscript squares (稿紙) or a
 * character-practice grid (田字格) with model and traced characters. Everything is measured in
 * page widths like the ink, so the same paper draws on screen and in the picture sent to a model.
 */
export type Paper =
  | { kind: 'dots' }
  | { kind: 'lines' }
  | { kind: 'squares'; columns: number }
  | { kind: 'practice'; rows: string[]; columns: number; traced: number }

/** A line of the paper: `border` lines are solid, `guide` lines (the cross in a practice cell) dashed. */
export interface PaperLine {
  x1: number
  y1: number
  x2: number
  y2: number
  style: 'border' | 'guide'
}

/** A character printed in a practice cell: the `model` to copy, or a faint one to `trace` over. */
export interface PaperGuide {
  char: string
  /** Centre of the cell. */
  x: number
  y: number
  /** Side of the cell. */
  size: number
  kind: 'model' | 'trace'
}

/** Ruled line spacing, in page widths. */
export const LINE_GAP = 0.06
/** Cells per row: the model, two to trace and three on your own, each big enough to write in on a phone. */
export const PRACTICE_COLUMNS = 6
export const ESSAY_COLUMNS = 14
/** At most this many characters are practised in one question, so the page stays reasonable. */
export const MAX_PRACTICE_ROWS = 40

/** The characters of a writing-practice answer, one practice row each ("春天" practises 春 and 天). */
export function practiceRows(values: string[]): string[] {
  return values.flatMap((v) => Array.from(v.replace(/\s+/g, ''))).slice(0, MAX_PRACTICE_ROWS)
}

export function practicePaper(values: string[]): Extract<Paper, { kind: 'practice' }> {
  return { kind: 'practice', rows: practiceRows(values), columns: PRACTICE_COLUMNS, traced: 2 }
}

/** The fixed height of a practice page; other papers grow with the writing. */
export function practiceHeight(paper: Extract<Paper, { kind: 'practice' }>): number {
  return Math.max(1, paper.rows.length) / paper.columns
}

export function paperLines(paper: Paper, height: number): PaperLine[] {
  const out: PaperLine[] = []
  const across = (y: number, style: PaperLine['style'] = 'border') => out.push({ x1: 0, y1: y, x2: 1, y2: y, style })
  if (paper.kind === 'lines') {
    for (let y = LINE_GAP; y < height; y += LINE_GAP) across(y)
  }
  if (paper.kind === 'squares') {
    const cell = 1 / paper.columns
    for (let y = 0; y <= height + 1e-9; y += cell) across(y)
    for (let c = 0; c <= paper.columns; c++) out.push({ x1: c * cell, y1: 0, x2: c * cell, y2: height, style: 'border' })
  }
  if (paper.kind === 'practice') {
    const cell = 1 / paper.columns
    const rows = Math.max(1, paper.rows.length)
    const bottom = rows * cell
    for (let r = 0; r <= rows; r++) across(r * cell)
    for (let c = 0; c <= paper.columns; c++) out.push({ x1: c * cell, y1: 0, x2: c * cell, y2: bottom, style: 'border' })
    // 田字格: a dashed cross through every cell
    for (let r = 0; r < rows; r++) across((r + 0.5) * cell, 'guide')
    for (let c = 0; c < paper.columns; c++) out.push({ x1: (c + 0.5) * cell, y1: 0, x2: (c + 0.5) * cell, y2: bottom, style: 'guide' })
  }
  return out
}

/** The model character at the start of each practice row, then the ones to trace over. */
export function paperGuides(paper: Paper): PaperGuide[] {
  if (paper.kind !== 'practice') return []
  const cell = 1 / paper.columns
  return paper.rows.flatMap((char, r) =>
    Array.from({ length: Math.min(paper.columns, 1 + paper.traced) }, (_, c) => ({
      char,
      x: (c + 0.5) * cell,
      y: (r + 0.5) * cell,
      size: cell,
      kind: c === 0 ? ('model' as const) : ('trace' as const),
    })),
  )
}

/** The paper's lines as SVG, `width` pixels per page width, e.g. under ink sent to a model. */
export function paperSvg(paper: Paper, height: number, width: number, color = '#c9cfdd'): string {
  return paperLines(paper, height)
    .map((l) => {
      const dash = l.style === 'guide' ? ` stroke-dasharray="${(width * 0.006).toFixed(1)} ${(width * 0.006).toFixed(1)}"` : ''
      return `<line x1="${(l.x1 * width).toFixed(1)}" y1="${(l.y1 * width).toFixed(1)}" x2="${(l.x2 * width).toFixed(1)}" y2="${(l.y2 * width).toFixed(1)}" stroke="${color}" stroke-width="${Math.max(1, width * 0.0015).toFixed(1)}"${dash}/>`
    })
    .join('')
}
