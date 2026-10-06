import { integrityCounts } from '@/features/classes/integrityCounts'
import { inClass } from '@/server/classes'
import { gradebook } from '@/server/gradebook'
import { getT } from '@/shared/i18n/server'

/** One CSV cell: quoted, and never read by a spreadsheet as a formula (a name starting with = or +). */
const cell = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return ''
  const text = String(v)
  const safe = /^[=+\-@\t\r]/.test(text) && typeof v === 'string' ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}
const csv = (rows: (string | number | null | undefined)[][]) => '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
const share = (score: number, max: number) => (max ? Math.round((score / max) * 1000) / 10 : null)

/**
 * 匯出成績 for the class's teacher: with `a`, one assignment student by student (status, score,
 * attempts, what the exam page noticed); without it, every assignment of the class side by side.
 * Excel opens it (UTF-8 with a BOM). `tz` is the browser's time zone, for the hand-in times.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const found = await inClass(id)
  if (!found?.teaches) return new Response('Not found', { status: 404 })
  const url = new URL(request.url)
  const only = url.searchParams.get('a') ?? undefined
  let zone = url.searchParams.get('tz') ?? 'UTC'
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
  } catch {
    zone = 'UTC'
  }
  const time = (iso: string | null) => (iso ? new Intl.DateTimeFormat('sv-SE', { timeZone: zone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '')
  const t = await getT()
  const book = await gradebook(found.classroom.id, only)
  if (only && !book.assignments.length) return new Response('Not found', { status: 404 })

  let rows: (string | number | null)[][]
  let name: string
  if (only) {
    const { assignment, stats, attempts } = book.assignments[0]!
    const byId = new Map(attempts.map((x) => [x.id, x]))
    name = assignment.title
    rows = [
      [t('學生'), t('狀態'), t('得分'), t('滿分'), t('得分率（%）'), t('次數'), t('交卷時間'), t('離開畫面次數'), t('離開畫面秒數'), t('截圖鍵次數'), t('複製貼上次數'), t('待批改')],
      ...stats.students.map((r) => {
        const c = r.counted
        const n = c ? integrityCounts(byId.get(c.attemptId)?.integrity ?? []) : null
        const status = !c ? t('未交') : !c.handedIn ? t('作答中') : t('已交')
        return [
          r.left ? t('已退出的學生') : r.name,
          status,
          c?.handedIn ? c.score : null,
          c?.handedIn ? c.max : null,
          c?.handedIn ? share(c.score, c.max) : null,
          r.tries,
          time(c?.finishedAt ?? null),
          n?.away ?? null,
          n ? Math.round(n.awayMs / 1000) : null,
          n?.screenshots ?? null,
          n?.copies ?? null,
          c?.handedIn ? c.pending : null,
        ]
      }),
    ]
  } else {
    name = found.classroom.name
    const students = book.members.filter((m) => m.role === 'student')
    rows = [
      [t('學生'), ...book.assignments.map(({ assignment }) => t('{title}（得分率 %）', { title: assignment.title })), t('平均得分率（%）')],
      ...students.map((m) => {
        const shares = book.assignments.map(({ stats }) => {
          const c = stats.students.find((r) => r.userId === m.userId)?.counted
          return c?.handedIn ? share(c.score, c.max) : null
        })
        const done = shares.filter((x): x is number => x !== null)
        return [m.name, ...shares, done.length ? Math.round((done.reduce((a, b) => a + b, 0) / done.length) * 10) / 10 : null]
      }),
    ]
  }
  const file = `${name.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'grades'}-${new Date().toISOString().slice(0, 10)}.csv`
  return new Response(csv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="grades.csv"; filename*=UTF-8''${encodeURIComponent(file)}`,
      'Cache-Control': 'no-store',
    },
  })
}
