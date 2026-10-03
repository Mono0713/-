import { assignmentStats, isOpen } from '@exam/classes'
import { isOver, summarize } from '@exam/quiz'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AssignmentControls } from '@/features/classes/AssignmentControls'
import { LocalTime } from '@/features/classes/LocalTime'
import { StartAssignment } from '@/features/classes/StartAssignment'
import { inAssignment } from '@/server/classes'
import { services } from '@/server/context'
import { Badge, Card, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

const ANSWER_RULES = { after_submit: '交卷後公布答案', after_close: '截止後公布答案', never: '不公布答案' } as const

const percent = (share: number | null) => (share === null ? '—' : `${Math.round(share * 100)}%`)

export default async function AssignmentPage({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const { id, aid } = await params
  const found = await inAssignment(aid)
  if (!found || found.classroom.id !== id) notFound()
  const { assignment: a, classroom, me, teaches } = found
  const { classes, quizzes } = services()
  const s = a.settings
  const facts = [
    s.mode === 'exam' ? '考試' : '練習',
    `${a.sources.length} 題`,
    s.timeLimitMinutes ? `限時 ${s.timeLimitMinutes} 分鐘` : null,
    s.maxAttempts ? `可作答 ${s.maxAttempts} 次` : '次數不限',
    ANSWER_RULES[s.answers],
  ].filter(Boolean)
  const times = (
    <p className="text-sm text-muted">
      {a.opensAt && (
        <>
          開始 <LocalTime at={a.opensAt} />
          {' · '}
        </>
      )}
      {a.closesAt ? (
        <>
          截止 <LocalTime at={a.closesAt} />
        </>
      ) : (
        '沒有截止時間'
      )}
    </p>
  )

  if (!teaches) {
    const tries = (await Promise.all((await classes.attempts(a.id, me.userId)).map((t) => quizzes.get(t.attemptId)))).filter((x) => x !== null)
    const running = tries.find((t) => !t.finishedAt && !isOver(t)) ?? null
    const left = s.maxAttempts === null ? null : Math.max(0, s.maxAttempts - tries.length)
    const open = isOpen(a)
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <PageHeader
          title={a.title}
          subtitle={
            <Link href={`/classes/${classroom.id}`} className="hover:underline">
              {classroom.name}
            </Link>
          }
        />
        <Card className="space-y-4 p-5">
          <div className="flex flex-wrap gap-1.5 text-xs text-muted">
            {facts.map((f) => (
              <span key={f} className="rounded-full border border-line px-2 py-0.5">
                {f}
              </span>
            ))}
          </div>
          {times}
          {running ? (
            <StartAssignment assignmentId={a.id} resume={running.id} label="" />
          ) : open && left !== 0 ? (
            <StartAssignment assignmentId={a.id} resume={null} label={tries.length ? '再作答一次' : '開始作答'} />
          ) : (
            <p className="text-sm text-muted">{!open ? (a.opensAt && new Date() < new Date(a.opensAt) ? '作業還沒開始。' : '作業已經截止。') : '已經用完可以作答的次數。'}</p>
          )}
          {left !== null && left > 0 && tries.length > 0 && !running && <p className="text-xs text-muted">還可以作答 {left} 次，老師看的是最後一次交的卷。</p>}
        </Card>
        {tries.some((t) => t.finishedAt) && (
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold">我交的卷</h2>
            <ul className="space-y-1">
              {tries
                .filter((t) => t.finishedAt)
                .map((t, i) => {
                  const sum = summarize(t)
                  return (
                    <li key={t.id}>
                      <Link href={`/quiz/${t.id}`} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-paper">
                        <span className="text-muted">第 {i + 1} 次</span>
                        <span className="flex-1 text-muted">
                          <LocalTime at={t.finishedAt!} />
                        </span>
                        {sum.pending > 0 && <Badge tone="accent">待批改 {sum.pending}</Badge>}
                        <span className="num">{sum.max ? `${sum.score} / ${sum.max}` : '已交'}</span>
                      </Link>
                    </li>
                  )
                })}
            </ul>
          </Card>
        )}
      </div>
    )
  }

  const [members, tries] = await Promise.all([classes.members(classroom.id), classes.attempts(a.id)])
  const attempts = (await Promise.all(tries.filter((t) => !t.preview).map((t) => quizzes.get(t.attemptId)))).filter((x) => x !== null)
  const stats = assignmentStats(a.sources, members, attempts)
  const missing = stats.students.filter((r) => !r.counted?.handedIn)
  const pending = stats.students.reduce((n, r) => n + (r.counted?.handedIn ? r.counted.pending : 0), 0)

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={a.title}
        subtitle={
          <Link href={`/classes/${classroom.id}`} className="hover:underline">
            {classroom.name}
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Card className="flex flex-wrap gap-x-10 gap-y-3 p-5">
            <div>
              <p className="text-xs text-muted">已交</p>
              <p className="num text-3xl">
                {stats.handedIn}
                <span className="text-lg text-muted"> / {stats.students.length}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">平均得分率</p>
              <p className="num text-3xl">{percent(stats.average)}</p>
            </div>
            {pending > 0 && (
              <div>
                <p className="text-xs text-muted">待批改</p>
                <p className="num text-3xl text-accent">{pending}</p>
              </div>
            )}
            {stats.aiMarked > 0 && (
              <div>
                <p className="text-xs text-muted">AI 批改 / 老師改過</p>
                <p className="num text-3xl">
                  {stats.aiMarked}
                  <span className="text-lg text-muted"> / {stats.overridden}</span>
                </p>
              </div>
            )}
          </Card>

          <Card className="overflow-x-auto p-2">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-3 py-2 font-medium">學生</th>
                  <th className="px-3 py-2 font-medium">狀態</th>
                  <th className="px-3 py-2 text-right font-medium">分數</th>
                  <th className="px-3 py-2 text-right font-medium">次數</th>
                  <th className="px-3 py-2 font-medium">交卷時間</th>
                </tr>
              </thead>
              <tbody>
                {stats.students.map((r) => {
                  const c = r.counted
                  const row = (
                    <>
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2">
                        {!c ? (
                          <Badge tone="warn">未交</Badge>
                        ) : !c.handedIn ? (
                          <Badge tone="accent">作答中</Badge>
                        ) : c.pending ? (
                          <Badge tone="accent">待批改 {c.pending}</Badge>
                        ) : (
                          <Badge tone="good">已交</Badge>
                        )}
                      </td>
                      <td className="num px-3 py-2 text-right">{c?.handedIn && c.max ? `${c.score} / ${c.max}` : '—'}</td>
                      <td className="num px-3 py-2 text-right text-muted">{r.tries || '—'}</td>
                      <td className="px-3 py-2 text-muted">{c?.finishedAt ? <LocalTime at={c.finishedAt} /> : '—'}</td>
                    </>
                  )
                  return c?.handedIn ? (
                    <tr key={r.userId} className="border-t border-line/70 hover:bg-paper">
                      {row}
                      <td className="px-3 py-2 text-right">
                        <Link href={`/classes/${classroom.id}/a/${a.id}/r/${c.attemptId}`} className="text-accent hover:underline">
                          批改
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    <tr key={r.userId} className="border-t border-line/70">
                      {row}
                      <td />
                    </tr>
                  )
                })}
                {stats.students.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted">
                      班上還沒有學生。把加入碼給學生，他們加入後會出現在這裡。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
          {missing.length > 0 && stats.students.length > 0 && <p className="text-sm text-muted">還沒交：{missing.map((r) => r.name).join('、')}</p>}

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">每題得分率</h2>
            {stats.handedIn === 0 ? (
              <p className="text-sm text-muted">有人交卷後會出現。</p>
            ) : (
              <ul className="space-y-1.5">
                {stats.questions.map((q) => (
                  <li key={q.questionId} className="flex items-center gap-3 text-sm">
                    <span className="w-8 shrink-0 text-right tabular-nums text-muted">{q.number}</span>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
                      <span className={`absolute inset-y-0 left-0 rounded-full ${q.rate !== null && q.rate < 0.5 ? 'bg-bad' : 'bg-good'}`} style={{ width: `${Math.round((q.rate ?? 0) * 100)}%` }} />
                    </span>
                    <span className="num w-11 shrink-0 text-right">{percent(q.rate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <aside className="space-y-4">
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap gap-1.5 text-xs text-muted">
              {facts.map((f) => (
                <span key={f} className="rounded-full border border-line px-2 py-0.5">
                  {f}
                </span>
              ))}
            </div>
            {times}
          </Card>
          <AssignmentControls classId={classroom.id} assignmentId={a.id} closesAt={a.closesAt} answers={s.answers} />
        </aside>
      </div>
    </div>
  )
}
