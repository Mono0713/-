import { isOpen, type Assignment } from '@exam/classes'
import { summarize } from '@exam/quiz'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { AiPayment } from '@/features/classes/AiPayment'
import { ClassMenu } from '@/features/classes/ClassMenu'
import { JoinPanel } from '@/features/classes/JoinPanel'
import { LocalTime } from '@/features/classes/LocalTime'
import { Members } from '@/features/classes/Members'
import { classSpend, inClass, resultsWithheld } from '@/server/classes'
import { services } from '@/server/context'
import { IconPlus } from '@/shared/icons'
import { Removable } from '@/shared/removal'
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

/** Where an assignment stands in time. */
function phase(a: Assignment, now = new Date()): 'upcoming' | 'open' | 'closed' {
  if (isOpen(a, now)) return 'open'
  return a.opensAt && now < new Date(a.opensAt) ? 'upcoming' : 'closed'
}

function Due({ a }: { a: Assignment }) {
  const p = phase(a)
  if (p === 'upcoming')
    return (
      <>
        開始於 <LocalTime at={a.opensAt!} />
      </>
    )
  if (a.closesAt)
    return (
      <>
        {p === 'closed' ? '已截止' : '截止'} <LocalTime at={a.closesAt} />
      </>
    )
  return <>沒有截止時間</>
}

/** The address people reach this server by, for links and QR codes. */
async function origin(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')
  return `${proto}://${host}`
}

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await inClass(id)
  if (!found) notFound()
  const { classroom, me, teaches } = found
  const { classes, quizzes } = services()
  const [members, assignments] = await Promise.all([classes.members(classroom.id), classes.assignments(classroom.id)])
  const students = members.filter((m) => m.role === 'student')
  const role = me.role === 'teacher' ? 'owner' : me.role

  const header = (
    <PageHeader
      title={classroom.name}
      subtitle={teaches ? `${students.length} 位學生 · ${assignments.length} 份作業` : `老師：${members.find((m) => m.role === 'teacher')?.name ?? ''}`}
      actions={
        <>
          <ClassMenu classId={classroom.id} name={classroom.name} role={role} />
          {teaches && (
            <ButtonLink href={`/classes/${classroom.id}/assign`} variant="primary" icon={<IconPlus size={16} />}>
              派作業
            </ButtonLink>
          )}
        </>
      }
    />
  )

  if (!teaches) {
    // A student sees their own state on each assignment.
    const mine = await Promise.all(
      assignments.map(async (a) => {
        const tries = await classes.attempts(a.id, me.userId)
        const attempts = (await Promise.all(tries.map((t) => quizzes.get(t.attemptId)))).filter((x) => x !== null)
        const done = attempts.filter((x) => x.finishedAt).at(-1)
        return { a, started: attempts.length > 0 && !done, done: done ? summarize(done) : null, withheld: done ? await resultsWithheld(done) : false }
      }),
    )
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        {assignments.length === 0 ? (
          <EmptyState title="還沒有作業">老師派作業後會出現在這裡。</EmptyState>
        ) : (
          <ul className="m-stagger space-y-3">
            {mine.map(({ a, started, done, withheld }) => (
              <li key={a.id}>
                <Link href={`/classes/${classroom.id}/a/${a.id}`} className="block">
                  <Card interactive className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                    <span className="min-w-0 flex-1 font-medium">{a.title}</span>
                    {done ? (
                      <span className="num text-sm">{done.max && !withheld ? `${done.score} / ${done.max}` : '已交'}</span>
                    ) : started ? (
                      <Badge tone="accent">作答中</Badge>
                    ) : phase(a) === 'open' ? (
                      <Badge tone="warn">未交</Badge>
                    ) : null}
                    <span className="w-full text-xs text-muted">
                      {a.settings.mode === 'exam' ? '考試' : '練習'} · {a.sources.length} 題 · <Due a={a} />
                    </span>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  const link = `${await origin()}/classes/join/${classroom.joinCode}`
  const qr = await QRCode.toString(link, { type: 'svg', margin: 1, color: { dark: '#1b2340', light: '#ffffff' } })
  const handedIn = await Promise.all(
    assignments.map(async (a) => {
      const tries = (await classes.attempts(a.id)).filter((t) => !t.preview)
      const finished = await Promise.all(tries.map(async (t) => ((await quizzes.get(t.attemptId))?.finishedAt ? t.userId : null)))
      return new Set(finished.filter((u) => u !== null && students.some((s) => s.userId === u))).size
    }),
  )
  const spent = await classSpend(classroom)

  return (
    <div className="mx-auto max-w-5xl">
      {header}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 space-y-3">
          {assignments.length === 0 ? (
            <EmptyState title="還沒有派作業">按「派作業」從題庫挑一份考卷給全班，可以設定截止時間、限時、次數和公布答案的時間。</EmptyState>
          ) : (
            <ul className="m-stagger space-y-3">
              {assignments.map((a, i) => (
                <Removable key={a.id} id={a.id}>
                  <li>
                    <Link href={`/classes/${classroom.id}/a/${a.id}`} className="block">
                      <Card interactive className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                        <span className="min-w-0 flex-1 font-medium">{a.title}</span>
                        <span className="text-sm text-muted">
                          已交 <span className="num text-ink">{handedIn[i]}</span> / {students.length}
                        </span>
                        <span className="w-full text-xs text-muted">
                          {a.settings.mode === 'exam' ? '考試' : '練習'} · {a.sources.length} 題 · <Due a={a} />
                        </span>
                      </Card>
                    </Link>
                  </li>
                </Removable>
              ))}
            </ul>
          )}
        </section>
        <aside className="space-y-4">
          <JoinPanel classId={classroom.id} code={classroom.joinCode} open={classroom.joinOpen} link={link} qr={qr} />
          <Members classId={classroom.id} members={members.map(({ userId, name, role }) => ({ userId, name, role }))} me={me.userId} isOwner={me.role === 'teacher'} />
          <AiPayment classId={classroom.id} payer={classroom.aiPayer} cap={classroom.aiMonthlyCapUsd} spent={spent.usd} unpriced={spent.unpriced} canEdit={me.role === 'teacher'} />
        </aside>
      </div>
    </div>
  )
}
