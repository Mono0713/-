import { isOpen, rulesFor, type Assignment } from '@exam/classes'
import { summarize } from '@exam/quiz'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { AiPayment } from '@/features/classes/AiPayment'
import { Announcements } from '@/features/classes/Announcements'
import { ClassMenu } from '@/features/classes/ClassMenu'
import { ExportLink } from '@/features/classes/ExportLink'
import { JoinPanel } from '@/features/classes/JoinPanel'
import { LocalTime } from '@/features/classes/LocalTime'
import { Members } from '@/features/classes/Members'
import { classSpend, inClass, resultsWithheld } from '@/server/classes'
import { services } from '@/server/context'
import type { T } from '@/shared/i18n/format'
import { rich } from '@/shared/i18n/rich'
import { getT } from '@/shared/i18n/server'
import { IconPlus } from '@/shared/icons'
import { Removable } from '@/shared/removal'
import { Badge, ButtonLink, Card, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

/** Where an assignment stands in time. */
function phase(a: Assignment, now = new Date()): 'upcoming' | 'open' | 'closed' {
  if (isOpen(a, now)) return 'open'
  return a.opensAt && now < new Date(a.opensAt) ? 'upcoming' : 'closed'
}

function Due({ a, t }: { a: Assignment; t: T }) {
  const p = phase(a)
  if (p === 'upcoming') return <>{rich(t('開始於 <time></time>'), { time: () => <LocalTime at={a.opensAt!} /> })}</>
  if (a.closesAt) {
    const closesAt = a.closesAt
    return <>{rich(p === 'closed' ? t('已截止 <time></time>') : t('截止 <time></time>'), { time: () => <LocalTime at={closesAt} /> })}</>
  }
  return <>{t('沒有截止時間')}</>
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
  const t = await getT()
  const found = await inClass(id)
  if (!found) notFound()
  const { classroom, me, teaches } = found
  const { classes, quizzes } = services()
  const [members, assignments, notes] = await Promise.all([classes.members(classroom.id), classes.assignments(classroom.id), classes.announcements(classroom.id)])
  const announcements = (
    <Announcements
      classId={classroom.id}
      canPost={teaches}
      items={notes.map((n) => ({ id: n.id, text: n.text, createdAt: n.createdAt, author: members.find((m) => m.userId === n.authorId)?.name ?? t('老師') }))}
    />
  )
  const students = members.filter((m) => m.role === 'student')
  const role = me.role === 'teacher' ? 'owner' : me.role

  const header = (
    <PageHeader
      title={classroom.name}
      subtitle={teaches ? t('{students} 位學生 · {assignments} 份作業', { students: students.length, assignments: assignments.length }) : t('老師：{name}', { name: members.find((m) => m.role === 'teacher')?.name ?? '' })}
      actions={
        <>
          <ClassMenu classId={classroom.id} name={classroom.name} role={role} />
          {teaches && (
            <ButtonLink href={`/classes/assign?class=${classroom.id}`} variant="primary" icon={<IconPlus size={16} />}>
              {t('派作業')}
            </ButtonLink>
          )}
        </>
      }
    />
  )

  if (!teaches) {
    // A student sees their own state on each assignment.
    const mine = await Promise.all(
      // Each with the student's own deadline when the teacher gave them more time.
      assignments.map((x) => ({ ...x, closesAt: rulesFor(x, me.userId).closesAt })).map(async (a) => {
        const tries = await classes.attempts(a.id, me.userId)
        const attempts = (await Promise.all(tries.map((x) => quizzes.get(x.attemptId)))).filter((x) => x !== null)
        const done = attempts.filter((x) => x.finishedAt).at(-1)
        return { a, started: attempts.length > 0 && !done, done: done ? summarize(done) : null, withheld: done ? await resultsWithheld(done) : false }
      }),
    )
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        {header}
        {announcements}
        <Link href={`/classes/${classroom.id}/s/${me.userId}`} className="block">
          <Card interactive className="flex items-center gap-3 p-4">
            <span className="flex-1 text-sm font-medium">{t('我的成績')}</span>
            <span className="text-xs text-muted">{t('歷次成績和常錯的題型')}</span>
            <span className="text-muted">→</span>
          </Card>
        </Link>
        {assignments.length === 0 ? (
          <EmptyState title={t('還沒有作業')}>{t('老師派作業後會出現在這裡。')}</EmptyState>
        ) : (
          <ul className="m-stagger space-y-3">
            {mine.map(({ a, started, done, withheld }) => (
              <li key={a.id}>
                <Link href={`/classes/${classroom.id}/a/${a.id}`} className="block">
                  <Card interactive className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                    <span className="min-w-0 flex-1 font-medium">{a.title}</span>
                    {done ? (
                      <span className="num text-sm">{done.max && !withheld ? `${done.score} / ${done.max}` : t('已交')}</span>
                    ) : started ? (
                      <Badge tone="accent">{t('作答中')}</Badge>
                    ) : phase(a) === 'open' ? (
                      <Badge tone="warn">{t('未交')}</Badge>
                    ) : null}
                    <span className="w-full text-xs text-muted">
                      {a.settings.mode === 'exam' ? t('考試') : t('練習')} · {t('{n} 題', { n: a.sources.length })} · <Due a={a} t={t} />
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
      const tries = (await classes.attempts(a.id)).filter((x) => !x.preview)
      const finished = await Promise.all(tries.map(async (x) => ((await quizzes.get(x.attemptId))?.finishedAt ? x.userId : null)))
      return new Set(finished.filter((u) => u !== null && students.some((s) => s.userId === u))).size
    }),
  )
  const spent = await classSpend(classroom)

  return (
    <div className="mx-auto max-w-5xl">
      {header}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 space-y-3">
          {announcements}
          {assignments.length === 0 ? (
            <EmptyState title={t('還沒有派作業')}>{t('按「派作業」從題庫挑一份考卷給全班，可以設定截止時間、限時、次數和公布答案的時間。')}</EmptyState>
          ) : (
            <ul className="m-stagger space-y-3">
              {assignments.map((a, i) => (
                <Removable key={a.id} id={a.id}>
                  <li>
                    <Link href={`/classes/${classroom.id}/a/${a.id}`} className="block">
                      <Card interactive className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                        <span className="min-w-0 flex-1 font-medium">{a.title}</span>
                        <span className="text-sm text-muted">
                          {rich(t('已交 <n>{done}</n> / {total}', { done: handedIn[i]!, total: students.length }), { n: (c) => <span className="num text-ink">{c}</span> })}
                        </span>
                        <span className="w-full text-xs text-muted">
                          {a.settings.mode === 'exam' ? t('考試') : t('練習')} · {t('{n} 題', { n: a.sources.length })} · <Due a={a} t={t} /> ·{' '}
                          {rich(t('派發 <time></time>'), { time: () => <LocalTime at={a.createdAt} /> })}
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
          {assignments.length > 0 && (
            <Card className="p-4">
              <ExportLink classId={classroom.id} label={t('匯出全班成績')} />
            </Card>
          )}
          <JoinPanel classId={classroom.id} code={classroom.joinCode} open={classroom.joinOpen} link={link} qr={qr} />
          <Members classId={classroom.id} members={members.map(({ userId, name, role }) => ({ userId, name, role }))} me={me.userId} isOwner={me.role === 'teacher'} />
          <AiPayment classId={classroom.id} payer={classroom.aiPayer} cap={classroom.aiMonthlyCapUsd} spent={spent.usd} unpriced={spent.unpriced} canEdit={me.role === 'teacher'} />
        </aside>
      </div>
    </div>
  )
}
