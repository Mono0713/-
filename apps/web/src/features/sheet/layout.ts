/** One piece of the printed paper: the header, a section heading, a shared passage or a question. */
export interface Block {
  height: number
  /** Never left alone at the bottom of a page: a heading or a passage stays with what follows it. */
  keepWithNext?: boolean
}

/**
 * Packs blocks onto pages `room` high, in order, `gap` apart, never splitting one.
 * A block that keeps with the next moves over together with it; a run too tall for any page is
 * placed block by block, and a single block taller than a page gets a page of its own.
 * Returns the indexes of the blocks on each page.
 */
export function paginate(blocks: Block[], room: number, gap: number): number[][] {
  const pages: number[][] = [[]]
  let used = 0
  const place = (i: number) => {
    const page = pages[pages.length - 1]!
    used += (page.length ? gap : 0) + blocks[i]!.height
    page.push(i)
  }
  const height = (from: number, to: number) => blocks.slice(from, to).reduce((sum, b, k) => sum + b.height + (k ? gap : 0), 0)

  let i = 0
  while (i < blocks.length) {
    // the run that has to stay together: blocks that keep with the next, and the one they lead to
    let end = i
    while (end < blocks.length - 1 && blocks[end]!.keepWithNext) end++
    end++
    const page = pages[pages.length - 1]!
    const run = height(i, end)
    const fits = used + (page.length ? gap : 0) + run <= room
    if (!fits && page.length) {
      pages.push([])
      used = 0
    }
    if (run <= room) {
      for (let k = i; k < end; k++) place(k)
    } else {
      // too tall for one page anyway: fill page by page
      for (let k = i; k < end; k++) {
        const current = pages[pages.length - 1]!
        if (current.length && used + gap + blocks[k]!.height > room) {
          pages.push([])
          used = 0
        }
        place(k)
      }
    }
    i = end
  }
  return pages
}

/** Display width of option text, counting a CJK character as two and a formula by its source. */
function width(text: string): number {
  let w = 0
  for (const ch of text.replace(/\$|\\[a-zA-Z]+|[{}]/g, '')) w += /[⺀-￯]/.test(ch) ? 2 : 1
  return w
}

/** How many columns a choice question's options print in: four short ones share a line, as on a printed paper. */
export function optionColumns(options: { content: string }[], hasPictures: boolean): 1 | 2 | 4 {
  if (!options.length) return 1
  const widest = Math.max(...options.map((o) => (o.content.includes('\n') || o.content.includes('|') ? 99 : width(o.content))))
  if (hasPictures) return options.length <= 4 && widest <= 20 ? 4 : 2
  if (widest <= 14) return 4
  if (widest <= 34) return 2
  return 1
}
