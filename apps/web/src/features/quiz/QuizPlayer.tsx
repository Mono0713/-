'use client'

import { isEmptyInk } from '@exam/ink'
import type { Grade, QuizAttempt, QuizItem, QuizResponse } from '@exam/quiz'
import { answerKind, gradeItem } from '@exam/quiz/logic'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconChevronLeft, IconChevronRight, IconFinish, IconReveal, IconSparkles, IconTimer } from '@/shared/icons'
import { quizIsCalm } from '@/shared/motion/preference'
import { Button, Card } from '@/shared/ui'
import { checkAnswer, finishQuiz, markAnswer, saveResponse, translateQuestion } from './actions'
import { QuizQuestion } from './QuizQuestion'
import { Reveal } from './Reveal'

/**
 * Runs a quiz. Exam mode: move freely between questions, answers are saved as
 * you go, submit at the end (or when time runs out). Practice mode: one
 * question at a time, with the answer shown after each.
 */
export function QuizPlayer({ attempt, locale, aiMarks }: {
  attempt: QuizAttempt
  /** The reader's language, for the 翻譯 button on questions written in another one. */
  locale: string
  /** An AI teacher marks open answers when they are checked. */
  aiMarks: boolean
}) {
  const t = useT()
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
  const [tutoring, setTutoring] = useState(attempt.tutoring ?? {})
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
    const waiting = timers.current.get(i)
    if (waiting) clearTimeout(waiting)
    timers.current.delete(i)
    const r = responsesRef.current[i]
    if (r) await saveResponse(attempt.id, i, r)
  }
  const responsesRef = useRef(responses)
  responsesRef.current = responses

  const update = (i: number, r: QuizResponse) => {
    setResponses((all) => all.map((x, j) => (j === i ? r : x)))
    if (practice) return
    const waiting = timers.current.get(i)
    if (waiting) clearTimeout(waiting)
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

  // On a class assignment the teacher or AI marks; the student does not mark their own.
  const own = !attempt.assignment || Boolean(attempt.assignment.preview)

  const secondsLeft = useCountdown(practice ? null : attempt.deadline, finish)
  const [navOpen, setNavOpen] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)
  // the question being left, drawn over the new one while it slides off
  const [turning, setTurning] = useState<number | null>(null)
  // set once you change question, so the first question does not slide in on page load
  const [moved, setMoved] = useState(false)
  const go = (i: number) => {
    setDirection(i >= current ? 1 : -1)
    setTurning(i !== current && !quizIsCalm() ? current : null)
    setMoved(i !== current)
    setCurrent(i)
    setNavOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const item = items[current]!
  // 書寫模式: writing practice and compositions get a bigger writing area inside the same frame,
  // so moving between question types never rearranges the page.
  const focus = item.question.type === 'writing' || item.question.type === 'composition'
  const isChecked = checked[current]
  // The sparkle means AI: only when an AI teacher will mark this answer (never for choice questions).
  const aiChecks = aiMarks && !['single', 'multiple', 'true_false'].includes(answerKind(item.question).kind)
  const last = current === total - 1
  const progress = practice ? t('已完成 {done} / {total} 題', { done: checked.filter(Boolean).length, total }) : t('已作答 {done} / {total} 題', { done: answeredCount, total })
  // No dialog: with questions left blank the first press only says how many, and a second press hands in.
  const unanswered = total - answeredCount
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 3500)
    return () => clearTimeout(timer)
  }, [armed])
  const submit = () => (unanswered && !armed ? setArmed(true) : finish())
  const submitLabel = pending ? t('交卷中…') : armed && unanswered ? t('還有 {n} 題沒寫，再按一次交卷', { n: unanswered }) : t('交卷')

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
    // m-calm-zone: 設定裡的「做題時減少動畫」 stills everything in here
    <div className="m-calm-zone grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-6">
      {/* Phones: progress, time and the question list in a bar that stays on screen. */}
      <div className="sticky top-14 z-20 -mx-4 border-b border-line bg-paper/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium tabular-nums">
            {t('第 {n} / {total} 題', { n: current + 1, total })}
          </span>
          {secondsLeft !== null && (
            <span className={`flex items-center gap-1 text-sm font-semibold tabular-nums ${secondsLeft <= 60 ? 'm-last-minute text-pen' : ''}`}>
              <IconTimer size={15} />
              <Clock seconds={secondsLeft} />
            </span>
          )}
          <button type="button" onClick={() => setNavOpen(!navOpen)} className="ml-auto rounded-md border border-line bg-surface px-3 py-1 text-sm" aria-expanded={navOpen}>
            {t('題號')} {navOpen ? '▴' : '▾'}
          </button>
        </div>
        {navOpen && (
          <div className="mt-3 space-y-3 pb-1">
            <p className="text-xs text-muted">{progress}</p>
            {navGrid}
            {!practice && (
              <Button variant="primary" className="w-full" onClick={submit} disabled={pending}>
                {submitLabel}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-4">
        {/* One sheet size for every question, so the buttons under it stay put as types change.
            Keyed by question. The old sheet slides off quickly and is gone before the next one
            slides in from the side you are heading to, so two questions never show at once. */}
        <div className="relative">
          <div key={current} data-back={direction < 0 || undefined} className={moved ? 'm-leaf-in' : undefined}>
            <Card className="p-4 sm:min-h-[24rem] sm:p-5">
              <QuizQuestion
                item={item}
                index={current}
                response={responses[current] ?? null}
                onChange={isChecked ? undefined : (r) => update(current, r)}
                reveal={practice && isChecked}
                celebrate={practice && isChecked}
                locale={locale}
                // no translating during an exam
                onTranslate={practice ? () => translateQuestion(attempt.id, current) : undefined}
                focus={focus}
              />
            </Card>
          </div>
          {turning !== null && items[turning] && (
            <div key={`leaf-${turning}`} aria-hidden inert data-back={direction < 0 || undefined} className="m-leaf-out absolute inset-x-0 top-0" onAnimationEnd={(e) => e.target === e.currentTarget && setTurning(null)}>
              <Card className="p-4 sm:min-h-[24rem] sm:p-5">
                {/* drawn exactly as it was on screen (answer-mode switch, draft and translate buttons included),
                    so the whole sheet leaves together; it is inert, so the no-op handlers never run */}
                <QuizQuestion
                  item={items[turning]!}
                  index={turning}
                  response={responses[turning] ?? null}
                  onChange={checked[turning] ? undefined : () => {}}
                  reveal={practice && checked[turning]}
                  locale={locale}
                  onTranslate={practice ? () => translateQuestion(attempt.id, turning) : undefined}
                  focus={items[turning]!.question.type === 'writing' || items[turning]!.question.type === 'composition'}
                />
              </Card>
            </div>
          )}
        </div>

        {practice && isChecked && grades[current] && (
          <Reveal
            item={item}
            grade={grades[current]!}
            marking={markings[current] ?? null}
            onMark={own ? (credit) => mark(current, credit) : undefined}
            withheldNote={own ? undefined : t('老師還沒有公開答案。')}
            tutor={{ attemptId: attempt.id, index: current, turns: tutoring[current] ?? [], onTurns: (turns) => setTutoring((all) => ({ ...all, [current]: turns })) }}
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button onClick={() => go(current - 1)} disabled={current === 0} icon={<IconChevronLeft size={16} />}>
            {t('上一題')}
          </Button>
          <div className="flex gap-2">
            {practice && !isChecked && (
              <Button variant="primary" onClick={check} disabled={pending} loading={pending} icon={aiChecks ? <IconSparkles size={16} /> : <IconReveal size={16} />}>
                {pending ? t('檢查中…') : t('看答案')}
              </Button>
            )}
            {(!practice || isChecked) && !last && (
              <Button variant={practice ? 'primary' : 'secondary'} onClick={() => go(current + 1)}>
                {t('下一題')}
                <IconChevronRight size={16} />
              </Button>
            )}
            {last && (!practice || isChecked) && (
              <Button variant="primary" onClick={() => (practice ? finish() : submit())} disabled={pending} loading={pending} icon={<IconFinish size={16} />}>
                {practice ? t('完成練習') : armed && unanswered ? submitLabel : t('交卷')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="hidden space-y-3 lg:sticky lg:top-20 lg:block lg:self-start">
        {secondsLeft !== null && (
          <Card className="p-3 text-center">
            <p className="text-xs text-muted">{t('剩餘時間')}</p>
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
            {submitLabel}
          </Button>
        )}
      </aside>
    </div>
  )
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
  const t = useT()
  return (
    <span className="inline-flex" aria-label={t('{m} 分 {s} 秒', { m: Math.floor(seconds / 60), s: seconds % 60 })}>
      {Math.floor(seconds / 60)}
      <span className="m-colon">:</span>
      {String(seconds % 60).padStart(2, '0')}
    </span>
  )
}
