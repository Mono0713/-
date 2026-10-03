import { describe, expect, it } from 'vitest'
import { rehypeTableRows } from '../src/shared/tableRows'

const el = (tagName: string, children: object[] = []) => ({ type: 'element', tagName, properties: {}, children })
const text = (value: string) => ({ type: 'text', value })

describe('rehypeTableRows', () => {
  it('puts tables that follow one another in one row and leaves a lone table alone', () => {
    const tree = { type: 'root', children: [el('p'), text('\n'), el('table'), text('\n'), el('table'), text('\n'), el('p'), el('table')] }
    rehypeTableRows()(tree)
    const tags = tree.children.map((n) => ('tagName' in n ? n.tagName : '#text'))
    expect(tags).toEqual(['p', '#text', 'div', '#text', 'p', 'table'])
    const row = tree.children[2] as ReturnType<typeof el>
    expect(row.properties).toEqual({ className: ['table-row'] })
    expect(row.children.map((n) => (n as { tagName: string }).tagName)).toEqual(['table', 'table'])
  })
})
