/**
 * A rehype step: tables that follow one another (only blank lines between them) are put in one
 * row, so small tables sit side by side and wrap onto the next line only when they do not fit.
 * Exams often print two or three short tables next to each other; stacked they waste the page.
 */
interface Node {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: Node[]
}

const isTable = (n: Node) => n.type === 'element' && n.tagName === 'table'
const isBlank = (n: Node) => n.type === 'text' && !n.value?.trim()

function group(parent: Node) {
  const kids = parent.children
  if (!kids) return
  const out: Node[] = []
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i]!
    if (!isTable(n)) {
      group(n)
      out.push(n)
      continue
    }
    const run = [n]
    let j = i + 1
    while (j < kids.length) {
      let k = j
      while (k < kids.length && isBlank(kids[k]!)) k++
      if (k < kids.length && isTable(kids[k]!)) {
        run.push(kids[k]!)
        j = k + 1
      } else break
    }
    if (run.length > 1) {
      out.push({ type: 'element', tagName: 'div', properties: { className: ['table-row'] }, children: run })
      i = j - 1
    } else out.push(n)
  }
  parent.children = out
}

export function rehypeTableRows() {
  return (tree: Node) => group(tree)
}
