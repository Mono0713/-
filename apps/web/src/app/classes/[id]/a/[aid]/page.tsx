import { answerGrid, assignmentStats, distribution, isOpenFor, missedQuestions, optionStats, rulesFor } from '@exam/classes'
import { isOver, summarize, type IntegrityEvent } from '@exam/quiz'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AnswerGrid } from '@/features/classes/AnswerGrid'
import { AssignmentControls } from '@/features/classes/AssignmentControls'
import { ExportLink } from '@/features/classes/ExportLink'
import { LocalTime } from '@/features/classes/LocalTime'
import { MistakesButton } from '@/features/classes/MistakesButton'
import { OptionAnalysis } from '@/features/classes/OptionAnalysis'
import { ResultsTable } from '@/features/classes/ResultsTable'
import { ScoreDistribution } from '@/features/classes/ScoreDistribution'
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
  // A student sees their own deadline, tries and time when the teacher gave them more.
  const rules = rulesFor(a, me.userId)
  const mine = teaches ? { closesAt: a.closesAt, maxAttempts: s.maxAttempts, timeLimitMinutes: s.timeLimitMinutes } : rules
  const facts = [
    s.mode === 'exam' ? t('考試') : t('練習'),
    t('{n} 題', { n: a.sources.length }),
    s.mode === 'exam' && mine.timeLimitMinutes ? t('限時 {n} 分鐘', { n: mine.timeLimitMinutes }) : null,
    mine.maxAttempts ? t('可作答 {n} 次', { n: mine.maxAttempts }) : t('次數不限'),
    s.mode === 'exam' ? t(ANSWER_RULES[s.answers]) : null,
    s.mode === 'exam' && s.fullscreen ? t('全螢幕') : null,
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
      {mine.closesAt ? rich(t('截止 <time></time>'), { time: () => <LocalTime at={mine.closesAt!} /> }) : t('沒有截止時間')}
      {!teaches && rules.exception && (
        <>
          {' '}
          <Badge tone="accent">{t('老師給你延長')}</Badge>
        </>
      )}
    </p>
  )

  if (!teaches) {
    const tries = (await Promise.all((await classes.attempts(a.id, me.userId)).map((x) => quizzes.get(x.attemptId)))).filter((x) => x !== null)
    // The teacher counts the last paper handed in; its mistakes are the ones to practise.
    const handedIn = tries.filter((x) => x.finishedAt && !x.assignment?.preview).sort((x, y) => x.finishedAt!.localeCompare(y.finishedAt!)).at(-1)
    const withheld = handedIn ? await resultsWithheld(handedIn) : false
    const missed = handedIn && !withheld ? missedQuestions(handedIn).length : 0
    const running = tries.find((x) => !x.finishedAt && !isOver(x)) ?? null
    const left = rules.maxAttempts === null ? null : Math.max(0, rules.maxAttempts - tries.length)
    const open = isOpenFor(a, me.userId)
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
          {s.mode === 'exam' && <p className="text-xs text-muted">{s.fullscreen ? t('這是全螢幕考試：題目不能複製，離開全螢幕、切換分頁或程式、按截圖鍵都會記錄給老師。') : t('這份考試的題目不能複製，離開畫面、切換分頁或程式、按截圖鍵的次數會記錄給老師。')}</p>}
          {running ? (
            <StartAssignment assignmentId={a.id} resume={running.id} label="" fullscreen={false} />
          ) : open && left !== 0 ? (
            <StartAssignment assignmentId={a.id} resume={null} label={tries.length ? t('再作答一次') : t('開始作答')} fullscreen={s.mode === 'exam' && Boolean(s.fullscreen)} />
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
            {missed > 0 && (
              <div className="mt-3 border-t border-line/70 pt-3">
                <MistakesButton assignmentId={a.id} count={missed} />
              </div>
            )}
          </Card>
        )}
      </div>
    )
  }

  const [members, tries] = await Promise.all([classes.members(classroom.id), classes.attempts(a.id)])
  const attempts = (await Promise.all(tries.filter((x) => !x.preview).map((x) => quizzes.get(x.attemptId)))).filter((x) => x !== null)
  const stats = assignmentStats(a.sources, members, attempts)
  const pending = stats.students.reduce((n, r) => n + (r.counted?.handedIn ? r.counted.pending : 0), 0)
  const integrity = new Map<string, IntegrityEvent[]>(attempts.map((x) => [x.id, x.integrity ?? []]))

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

          <ResultsTable classId={classroom.id} assignment={a} students={stats.students} integrity={integrity} t={t} />
          {stats.handedIn > 0 && <AnswerGrid classId={classroom.id} assignmentId={a.id} questions={stats.questions} rows={answerGrid(a.sources, stats.students, stats.counted)} t={t} />}
          <ScoreDistribution d={distribution(stats.students)} average={stats.average} t={t} />

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold">{t('每題得分率')}</h2>
            {stats.handedIn === 0 ? (
              <p className="text-sm text-muted">{t('有人交卷後會出現。')}</p>
            ) : (
              <ul className="space-y-1.5">
                {stats.questions.map((q) => (
                  <li key={q.questionId} className="flex items-center gap-3 text-sm">
                    <Link href={`/classes/${classroom.id}/a/${a.id}/q/${q.questionId}`} className="w-8 shrink-0 text-right tabular-nums text-muted hover:text-accent hover:underline">
                      {q.number}
                    </Link>
                    <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink/[0.07]">
                      <span className={`absolute inset-y-0 left-0 rounded-full ${q.rate !== null && q.rate < 0.5 ? 'bg-bad' : 'bg-good'}`} style={{ width: `${Math.round((q.rate ?? 0) * 100)}%` }} />
                    </span>
                    <span className="num w-11 shrink-0 text-right">{percent(q.rate)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <OptionAnalysis stats={optionStats(a.sources, stats.counted)} handedIn={stats.handedIn} t={t} />
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
          <Card className="p-4">
            <ExportLink classId={classroom.id} assignmentId={a.id} label={t('匯出這份作業的成績')} />
          </Card>
        </aside>
      </div>
    </div>
  )
}
