import { assignmentStats, isOpen } from '@exam/classes'
import { isOver, summarize } from '@exam/quiz'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AssignmentControls } from '@/features/classes/AssignmentControls'
import { LocalTime } from '@/features/classes/LocalTime'
import { StartAssignment } from '@/features/classes/StartAssignment'
import { inAssignment, resultsWithheld } from '@/server/classes'
import { services } from '@/server/context'
import { msg } from '@/shared/i18n/format'
import { rich } from '@/shared/i18n/rich'
import { getT } from '@/shared/i18n/server'
import { Badge, Card, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

const ANSWER_RULES = { after_submit: msg('交卷後公布答案'), after_close: msg('截止後公布答案'), never: msg('不公布答案') } as const

const percent = (share: number | null) => (share === null ? '—' : `${Math.round(share * 100)}%`)

export default async function AssignmentPage({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const { id, aid } = await params
  const t = await getT()
  const found = await inAssignment(aid)
  if (!found || found.classroom.id !== id) notFound()
  const { assignment: a, classroom, me, teaches } = found
  const { classes, quizzes } = services()
  const s = a.settings
  const facts = [
    s.mode === 'exam' ? t('考試') : t('練習'),
    t('{n} 題', { n: a.sources.length }),
    s.timeLimitMinutes ? t('限時 {n} 分鐘', { n: s.timeLimitMinutes }) : null,
    s.maxAttempts ? t('可作答 {n} 次', { n: s.maxAttempts }) : t('次數不限'),
    t(ANSWER_RULES[s.answers]),
  ].filter(Boolean)
  const times = (
    <p className="text-sm text-muted">
      {teaches && (
        <>
          {rich(t('派發 <time></time>'), { time: () => <LocalTime at={a.createdAt} /> })}
          <br />
        </>
      )}
      {a.opensAt && (
        <>
          {rich(t('開始 <time></time>'), { time: () => <LocalTime at={a.opensAt!} /> })}
          {' · '}
        </>
      )}
      {a.closesAt ? (
        rich(t('截止 <time></time>'), { time: () => <LocalTime at={a.closesAt!} /> })
      ) : (
        t('沒有截止時間')
      )}
    </p>
  )

  if (!teaches) {
    const tries = (await Promise.all((await classes.attempts(a.id, me.userId)).map((x) => quizzes.get(x.attemptId)))).filter((x) => x !== null)
    const handedIn = tries.find((x) => x.finishedAt && !x.assignment?.preview)
    const withheld = handedIn ? await resultsWithheld(handedIn) : false
    const running = tries.find((x) => !x.finishedAt && !isOver(x)) ?? null
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
            <StartAssignment assignmentId={a.id} resume={null} label={tries.length ? t('再作答一次') : t('開始作答')} />
          ) : (
            <p className="text-sm text-muted">{!open ? (a.opensAt && new Date() < new Date(a.opensAt) ? t('作業還沒開始。') : t('作業已經截止。')) : t('已經用完可以作答的次數。')}</p>
          )}
          {left !== null && left > 0 && tries.length > 0 && !running && <p className="text-xs text-muted">{t('還可以作答 {n} 次，老師看的是最後一次交的卷。', { n: left })}</p>}
        </Card>
        {/* The score waits with the answers. */}
        {tries.some((x) => x.finishedAt) && (
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-semibold">{t('我交的卷')}</h2>
            <ul className="space-y-1">
              {tries
                .filter((x) => x.finishedAt)
                .map((x, i) => {
                  const sum = summarize(x)
                  return (
                    <li key={x.id}>
                      <Link href={`/quiz/${x.id}`} className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-paper">
                        <span className="text-muted">{t('第 {n} 次', { n: i + 1 })}</span>
                        <span className="flex-1 text-muted">
                          <LocalTime at={x.finishedAt!} />
                        </span>
                        {sum.pending > 0 && !withheld && <Badge tone="accent">{t('待批改 {n}', { n: sum.pending })}</Badge>}
                        <span className="num">{sum.max && !withheld ? `${sum.score} / ${sum.max}` : t('已交')}</span>
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
  const attempts = (await Promise.all(tries.filter((x) => !x.preview).map((x) => quizzes.get(x.attemptId)))).filter((x) => x !== null)
  const stats = assignmentStats(a.sources, members, attempts)
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
              <p className="text-xs text-muted">{t('已交')}</p>
              <p className="num text-3xl">
                {stats.handedIn}
                <span className="text-lg text-muted"> / {stats.students.length}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">{t('平均得分率')}</p>
              <p className="num text-3xl">{percent(stats.average)}</p>
            </div>
            {pending > 0 && (
              <div>
                <p className="text-xs text-muted">{t('待批改')}</p>
                <p className="num text-3xl text-accent">{pending}</p>
              </div>
            )}
            {stats.aiMarked > 0 && (
              <div>
                <p className="text-xs text-muted">{t('AI 批改 / 老師改過')}</p>
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
                  <th className="px-3 py-2 font-medium">{t('學生')}</th>
                  <th className="px-3 py-2 font-medium">{t('狀態')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('得分')}</th>
                  <th className="px-3 py-2 text-right font-medium">{t('次數')}</th>
                  <th className="px-3 py-2 font-medium">{t('交卷時間')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.students.map((r) => {
                  const c = r.counted
                  const row = (
                    <>
                      <td className={`px-3 py-2 font-medium ${r.left ? 'text-muted' : ''}`}>{r.left ? t('已退出的學生') : r.name}</td>
                      <td className="px-3 py-2">
                        {!c ? (
                          <Badge tone="warn">{t('未交')}</Badge>
                        ) : !c.handedIn ? (
                          <Badge tone="accent">{t('作答中')}</Badge>
                        ) : c.pending ? (
                          <Badge tone="accent">{t('待批改 {n}', { n: c.pending })}</Badge>
                        ) : (
                          <Badge tone="good">{t('已交')}</Badge>
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
                          {t('批改')}
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
                      {t('班上還沒有學生。把加入碼給學生，他們加入後會出現在這裡。')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">{t('每題得分率')}</h2>
            {stats.handedIn === 0 ? (
              <p className="text-sm text-muted">{t('有人交卷後會出現。')}</p>
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
          <AssignmentControls classId={classroom.id} assignmentId={a.id} closesAt={a.closesAt} answers={s.answers} practice={s.mode === 'practice'} />
        </aside>
      </div>
    </div>
  )
}
