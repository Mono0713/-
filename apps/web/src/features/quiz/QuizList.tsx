'use client'

import Link from 'next/link'
import { IconTrash } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { Badge } from '@/shared/ui'
import { removeQuiz } from './actions'

export interface QuizRow {
  id: string
  title: string
  exam: boolean
  count: number
  date: string
  /** null while it is still being answered */
  score: { score: number; max: number } | null
}

/**
 * The list of quizzes. Deleting is one click with no question asked: the row goes at once and a note
 * offers 復原 for a few seconds (see RemovalProvider).
 */
export function QuizList({ rows }: { rows: QuizRow[] }) {
  const { remove, isRemoved } = useRemoval()
  const removeRow = (row: QuizRow) => remove({ id: row.id, note: row.score ? '已刪除測驗紀錄' : '已刪除測驗', commit: () => removeQuiz(row.id) })

  const shown = rows.filter((r) => !isRemoved(r.id))
  if (!shown.length) return null
  return (
    <ul className="m-stagger divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-sheet">
      {shown.map((a) => (
        <li key={a.id} className="group relative">
          <Link href={`/quiz/${a.id}`} className="flex items-center gap-3 py-3 pl-4 pr-14 transition-colors hover:bg-paper">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-medium sm:truncate">{a.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <Badge tone={a.exam ? 'accent' : 'neutral'}>{a.exam ? '考試' : '練習'}</Badge>
                {a.count} 題 · {a.date}
              </p>
            </div>
            {a.score ? (
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {a.score.score} / {a.score.max}
              </span>
            ) : (
              <span className="shrink-0">
                <Badge tone="warn">進行中</Badge>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => removeRow(a)}
            aria-label={`刪除「${a.title}」`}
            title="刪除"
            className="m-press absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted transition-[opacity,color,background-color] hover:bg-bad-soft hover:text-bad focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0"
          >
            <IconTrash size={16} />
          </button>
        </li>
      ))}
    </ul>
  )
}
