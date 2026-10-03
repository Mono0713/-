'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { IconTrash } from '@/shared/icons'
import { Toast } from '@/shared/Toast'
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

/** How long a deleted quiz waits for 復原 before it is really gone. */
const UNDO_MS = 5000

/**
 * The list of quizzes. Deleting is one click with no question asked: the row goes at once, a note
 * offers 復原 for a few seconds, and only then is the record removed. A quiz deleted from its own
 * page arrives here as ?removed=<id> and gets the same note.
 */
export function QuizList({ rows }: { rows: QuizRow[] }) {
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  const [hidden, setHidden] = useState<string[]>([])
  const [note, setNote] = useState<QuizRow | null>(null)
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const commit = useCallback((id: string) => {
    const timer = pending.current.get(id)
    if (timer === undefined) return
    clearTimeout(timer)
    pending.current.delete(id)
    void removeQuiz(id)
  }, [])

  const remove = useCallback(
    (row: QuizRow) => {
      setHidden((h) => (h.includes(row.id) ? h : [...h, row.id]))
      setNote(row)
      pending.current.set(
        row.id,
        setTimeout(() => {
          commit(row.id)
          setNote((n) => (n?.id === row.id ? null : n))
        }, UNDO_MS),
      )
    },
    [commit],
  )

  const undo = () => {
    if (!note) return
    clearTimeout(pending.current.get(note.id))
    pending.current.delete(note.id)
    setHidden((h) => h.filter((id) => id !== note.id))
    setNote(null)
  }

  // deleted on its own page: start the same countdown here, and drop the parameter from the address
  const removed = params.get('removed')
  const handled = useRef(new Set<string>())
  useEffect(() => {
    if (!removed) return
    const row = rows.find((r) => r.id === removed)
    if (row && !handled.current.has(row.id)) {
      handled.current.add(row.id)
      remove(row)
    }
    router.replace(path, { scroll: false })
  }, [removed, rows, remove, router, path])

  // leaving the page or closing the tab ends the wait: what was deleted stays deleted
  // (checked a moment later, so a remount in development does not count as leaving)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    const map = pending.current
    const flush = () => [...map.keys()].forEach(commit)
    const onHide = () => document.visibilityState === 'hidden' && flush()
    document.addEventListener('visibilitychange', onHide)
    return () => {
      mounted.current = false
      document.removeEventListener('visibilitychange', onHide)
      setTimeout(() => mounted.current || flush())
    }
  }, [commit])

  const shown = rows.filter((r) => !hidden.includes(r.id))
  return (
    <>
      {shown.length > 0 && (
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
                onClick={() => remove(a)}
                aria-label={`刪除「${a.title}」`}
                title="刪除"
                className="m-press absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted transition-[opacity,color,background-color] hover:bg-bad-soft hover:text-bad focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:opacity-0"
              >
                <IconTrash size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Toast show={note !== null} action="復原" onAction={undo}>
        已刪除{note?.score ? '測驗紀錄' : '測驗'}
      </Toast>
    </>
  )
}
