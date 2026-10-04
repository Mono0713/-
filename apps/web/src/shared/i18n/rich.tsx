import { Fragment, type ReactNode } from 'react'

/**
 * Turns translated text with tags into elements: rich(t('到<link>設定</link>加金鑰'), { link: (c) => <Link href="/settings">{c}</Link> }).
 * Tags keep a sentence whole for translators instead of splitting it around the link.
 */
export function rich(text: string, tags: Record<string, (children: ReactNode) => ReactNode>): ReactNode {
  const out: ReactNode[] = []
  const pattern = /<(\w+)>(.*?)<\/\1>/gs
  let last = 0
  let i = 0
  for (const m of text.matchAll(pattern)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const render = tags[m[1]!]
    out.push(<Fragment key={i++}>{render ? render(m[2]!) : m[2]}</Fragment>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.length === 1 ? out[0] : out
}
