import Link from 'next/link'
import type { T } from '@/shared/i18n/format'
import { rich } from '@/shared/i18n/rich'
import { Badge, Card } from '@/shared/ui'
import { LocalTime } from './LocalTime'

export interface TodoItem {
  href: string
  title: string
  className: string
  closesAt: string | null
  started: boolean
}

const DAY = 86_400_000

/** A student's assignments still to hand in, across their classes, soonest deadline first. */
export function TodoList({ items, t, now = Date.now() }: { items: TodoItem[]; t: T; now?: number }) {
  if (!items.length) return null
  const sorted = [...items].sort((a, b) => (a.closesAt ?? '9999').localeCompare(b.closesAt ?? '9999'))
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{t('待完成')}</h2>
      <ul className="space-y-2">
        {sorted.map((i) => {
          const soon = i.closesAt !== null && new Date(i.closesAt).getTime() - now < DAY
          return (
            <li key={i.href}>
              <Link href={i.href} className="block">
                <Card interactive className={`flex flex-wrap items-center gap-x-3 gap-y-1 p-3 ${soon ? 'border-l-2 border-l-warn' : ''}`}>
                  <span className="min-w-0 flex-1 font-medium">{i.title}</span>
                  {i.started && <Badge tone="accent">{t('作答中')}</Badge>}
                  {soon && <Badge tone="warn">{t('快截止')}</Badge>}
                  <span className="w-full text-xs text-muted">
                    {i.className} · {i.closesAt ? rich(t('截止 <time></time>'), { time: () => <LocalTime at={i.closesAt!} /> }) : t('沒有截止時間')}
                  </span>
                </Card>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
