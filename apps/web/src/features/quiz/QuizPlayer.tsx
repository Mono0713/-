'use client'

import { isEmptyInk } from '@exam/ink'
import type { Grade, QuizAttempt, QuizItem, QuizResponse } from '@exam/quiz'
import { gradeItem } from '@exam/quiz/logic'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { IconChevronLeft, IconChevronRight, IconFinish, IconSparkles, IconTimer } from '@/shared/icons'
import { Button, Card } from '@/shared/ui'
import { checkAnswer, finishQuiz, markAnswer, saveResponse } from './actions'
import { QuizQuestion } from './QuizQuestion'
import { Reveal } from './Reveal'

/**
 * Runs a quiz. Exam mode: move freely between questions, answers are saved as
 * you go, submit at the end (or when time runs out). Practice mode: one
 * question at a time, with the answer shown after each.
 */
export function QuizPlayer({ attempt }: { attempt: QuizAttempt }) {
  const router = useRouter()
  const practice = attempt.settings.mode === 'practice'
  const [items, setItems] = useState<QuizItem[]>(attempt.items)
  const [responses, setResponses] = useState(attempt.responses)
  // Checked practice questions arrive with their answers, so they can be graded here after a reload.
  const [grades, setGrades] = useState<(Grade | null)[]>(() =>
    attempt.items.map((item, i) => (attempt.checked[i] ? gradeItem(item, attempt.responses[i] ?? null, attempt.markings[i] ?? null) : null)),
  )
  const [markings, setMarkings] = useState(attempt.markings)
  const [checked, setChecked] = useState(attempt.checked)
  const [current, setCurrent] = useState(() => (practice ? Math.max(0, attempt.checked.indexOf(false)) : 0))
  const [pending, start] = useTransition()
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const total = items.length
  const answered = (i: number) => Boolean(responses[i]?.values.some((v) => v.trim()) || !isEmptyInk(responses[i]?.handwriting))
  const answeredCount = responses.filter((_, i) => answered(i)).length

  const finish = () =>
    start(async () => {
      await Promise.all([...timers.current.keys()].map((i) => flush(i)))
      await finishQuiz(attempt.id)
      router.refresh()
    })

  const flush = async (i: number) => {
    const t = timers.current.get(i)
    if (t) clearTimeout(t)
    timers.current.delete(i)
    const r = responsesRef.current[i]
    if (r) await saveResponse(attempt.id, i, r)
  }
  const responsesRef = useRef(responses)
  responsesRef.current = responses

  const update = (i: number, r: QuizResponse) => {
    setResponses((all) => all.map((x, j) => (j === i ? r : x)))
    if (practice) return
    const t = timers.current.get(i)
    if (t) clearTimeout(t)
    timers.current.set(
      i,
      setTimeout(() => {
        timers.current.delete(i)
        void saveResponse(attempt.id, i, r)
      }, 600),
    )
  }

  const check = () =>
    start(async () => {
      const result = await checkAnswer(attempt.id, current, responses[current] ?? { values: [] })
      setItems((all) => all.map((x, j) => (j === current ? result.item : x)))
      // Handwriting comes back with what the AI read.
      setResponses((all) => all.map((x, j) => (j === current ? result.response : x)))
      setGrades((all) => all.map((x, j) => (j === current ? result.grade : x)))
      setMarkings((all) => all.map((x, j) => (j === current ? result.marking : x)))
      setChecked((all) => all.map((x, j) => (j === current ? true : x)))
    })

  const mark = (i: number, credit: number | null) =>
    start(async () => {
      const result = await markAnswer(attempt.id, i, credit)
      setMarkings((all) => all.map((x, j) => (j === i ? result.marking : x)))
      setGrades((all) => all.map((x, j) => (j === i ? result.grade : x)))
    })

  const secondsLeft = useCountdown(practice ? null : attempt.deadline, finish)
  const [navOpen, setNavOpen] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)
  // the question being left, drawn over the new one while it slides off
  const [turning, setTurning] = useState<number | null>(null)
  // set once you change question, so the first question does not slide in on page load
  const [moved, setMoved] = useState(false)
  const go = (i: number) => {
    setDirection(i >= current ? 1 : -1)
    setTurning(i !== current && !matchMedia('(prefers-reduced-motion: reduce)').matches ? current : null)
    setMoved(i !== current)
    setCurrent(i)
    setNavOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const item = items[current]!
  const isChecked = checked[current]
  const last = current === total - 1
  const progress = practice ? `已完成 ${checked.filter(Boolean).length} / ${total} 題` : `已作答 ${answeredCount} / ${total} 題`
  const submit = () => confirm(confirmText(total - answeredCount)) && finish()

  const navGrid = (
    <div className="grid grid-cols-6 gap-1 sm:grid-cols-8 lg:grid-cols-6">
      {items.map((_, i) => {
        const g = grades[i]
        const tone =
          i === current
            ? 'border-accent bg-accent text-on-accent'
            : practice && checked[i]
              ? g?.status === 'correct'
                ? 'border-good/40 bg-good-soft text-good'
                : g?.status === 'wrong' || g?.status === 'unanswered'
                  ? 'border-bad/40 bg-bad-soft text-bad'
                  : 'border-line bg-paper text-muted'
              : answered(i)
                ? 'border-accent/30 bg-accent-soft text-accent'
                : 'border-line bg-surface text-muted'
        return (
          <button key={i} type="button" onClick={() => go(i)} className={`m-press h-9 rounded-md border text-xs tabular-nums lg:h-8 ${tone}`}>
            {i + 1}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-6">
      {/* Phones: progress, time and the question list in a bar that stays on screen. */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium tabular-nums">
            第 {current + 1} / {total} 題
          </span>
          {secondsLeft !== null && (
            <span className={`flex items-center gap-1 text-sm font-semibold tabular-nums ${secondsLeft <= 60 ? 'm-last-minute text-pen' : ''}`}>
              <IconTimer size={15} />
              <Clock seconds={secondsLeft} />
            </span>
          )}
          <button type="button" onClick={() => setNavOpen(!navOpen)} className="ml-auto rounded-md border border-line bg-surface px-3 py-1 text-sm" aria-expanded={navOpen}>
            題號 {navOpen ? '▴' : '▾'}
          </button>
        </div>
        {navOpen && (
          <div className="mt-3 space-y-3 pb-1">
            <p className="text-xs text-muted">{progress}</p>
            {navGrid}
            {!practice && (
              <Button variant="primary" className="w-full" onClick={submit} disabled={pending}>
                {pending ? '交卷中…' : '交卷'}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        {/* Keyed by question. The old sheet slides off quickly and is gone before the next one
            slides in from the side you are heading to, so two questions never show at once. */}
        <div className="relative">
          <div key={current} data-back={direction < 0 || undefined} className={moved ? 'm-leaf-in' : undefined}>
            <Card className="p-4 sm:p-5">
              <QuizQuestion
                item={item}
                index={current}
                response={responses[current] ?? null}
                onChange={isChecked ? undefined : (r) => update(current, r)}
                reveal={practice && isChecked}
                celebrate={practice && isChecked}
              />
            </Card>
          </div>
          {turning !== null && items[turning] && (
            <div key={`leaf-${turning}`} aria-hidden inert data-back={direction < 0 || undefined} className="m-leaf-out absolute inset-x-0 top-0" onAnimationEnd={(e) => e.target === e.currentTarget && setTurning(null)}>
              <Card className="p-4 sm:p-5">
                <QuizQuestion item={items[turning]!} index={turning} response={responses[turning] ?? null} reveal={practice && checked[turning]} />
              </Card>
            </div>
          )}
        </div>

        {practice && isChecked && grades[current] && (
          <Reveal item={item} grade={grades[current]!} marking={markings[current] ?? null} onMark={(credit) => mark(current, credit)} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button onClick={() => go(current - 1)} disabled={current === 0} icon={<IconChevronLeft size={16} />}>
            上一題
          </Button>
          <div className="flex gap-2">
            {practice && !isChecked && (
              <Button variant="primary" onClick={check} disabled={pending} loading={pending} icon={<IconSparkles size={16} />}>
                {pending ? '檢查中…' : '看答案'}
              </Button>
            )}
            {(!practice || isChecked) && !last && (
              <Button variant={practice ? 'primary' : 'secondary'} onClick={() => go(current + 1)}>
                下一題
                <IconChevronRight size={16} />
              </Button>
            )}
            {last && (!practice || isChecked) && (
              <Button variant="primary" onClick={() => (practice ? finish() : submit())} disabled={pending} loading={pending} icon={<IconFinish size={16} />}>
                {practice ? '完成練習' : '交卷'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="hidden space-y-3 lg:sticky lg:top-20 lg:block lg:self-start">
        {secondsLeft !== null && (
          <Card className="p-3 text-center">
            <p className="text-xs text-muted">剩餘時間</p>
            {/* the last minute turns red-pen, the colon blinks and the clock beats once a second */}
            <p className={`num text-3xl ${secondsLeft <= 60 ? 'm-last-minute text-pen' : ''}`}>
              <Clock seconds={secondsLeft} />
            </p>
          </Card>
        )}
        <Card className="p-3">
          <p className="mb-2 text-xs text-muted">{progress}</p>
          {navGrid}
        </Card>
        {!practice && (
          <Button variant="primary" className="w-full" onClick={submit} disabled={pending}>
            {pending ? '交卷中…' : '交卷'}
          </Button>
        )}
      </aside>
    </div>
  )
}

function confirmText(unanswered: number) {
  return unanswered ? `還有 ${unanswered} 題沒作答，確定要交卷嗎？` : '確定要交卷嗎？'
}

/** Seconds left in a timed exam, or null without a limit; calls onEnd once at zero. */
function useCountdown(deadline: string | null, onEnd: () => void): number | null {
  const end = deadline ? new Date(deadline).getTime() : null
  const [left, setLeft] = useState(() => (end === null ? null : end - Date.now()))
  const ended = useRef(false)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  useEffect(() => {
    if (end === null) return
    const timer = setInterval(() => {
      const ms = end - Date.now()
      setLeft(ms)
      if (ms <= 0 && !ended.current) {
        ended.current = true
        onEndRef.current()
      }
    }, 500)
    return () => clearInterval(timer)
  }, [end])
  return left === null ? null : Math.max(0, Math.ceil(left / 1000))
}

function Clock({ seconds }: { seconds: number }) {
  return (
    <span className="inline-flex" aria-label={`${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`}>
      {Math.floor(seconds / 60)}
      <span className="m-colon">:</span>
      {String(seconds % 60).padStart(2, '0')}
    </span>
  )
}
