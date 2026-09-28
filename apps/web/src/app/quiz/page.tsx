import { summarize } from '@exam/quiz'
import Link from 'next/link'
import { currentOwner, services } from '@/server/context'
import { Badge, ButtonLink, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function QuizListPage() {
  const attempts = services().quizzes.list(currentOwner())
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="線上測驗"
        subtitle={`${attempts.length} 次紀錄`}
        actions={
          <ButtonLink href="/quiz/new" variant="primary">
            新測驗
          </ButtonLink>
        }
      />
      {attempts.length === 0 ? (
        <EmptyState title="還沒有測驗紀錄">從題庫挑考卷或題目，選擇考試或單題練習。</EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {attempts.map((a) => {
            const s = summarize(a)
            const done = a.finishedAt !== null
            return (
              <li key={a.id}>
                <Link href={`/quiz/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-paper">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-medium sm:truncate">{a.title}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge tone={a.settings.mode === 'exam' ? 'accent' : 'neutral'}>{a.settings.mode === 'exam' ? '考試' : '練習'}</Badge>
                      {a.items.length} 題 · {new Date(a.startedAt).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                  {done ? (
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {s.score} / {s.max}
                    </span>
                  ) : (
                    <span className="shrink-0">
                      <Badge tone="warn">進行中</Badge>
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
