'use client'

import type { Grade, QuizAttempt, QuizItem, QuizResponse } from '@exam/quiz'
import { grade as gradeOf } from '@exam/quiz/logic'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
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
    attempt.items.map((item, i) => (attempt.checked[i] ? gradeOf(item.question, attempt.responses[i] ?? null, attempt.markings[i] ?? null) : null)),
  )
  const [markings, setMarkings] = useState(attempt.markings)
  const [checked, setChecked] = useState(attempt.checked)
  const [current, setCurrent] = useState(() => (practice ? Math.max(0, attempt.checked.indexOf(false)) : 0))
  const [pending, start] = useTransition()
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const total = items.length
  const answered = (i: number) => Boolean(responses[i]?.values.some((v) => v.trim()))
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
      setGrades((all) => all.map((x, j) => (j === current ? result.grade : x)))
      setChecked((all) => all.map((x, j) => (j === current ? true : x)))
    })

  const mark = (i: number, credit: number | null) =>
    start(async () => {
      const result = await markAnswer(attempt.id, i, credit)
      setMarkings((all) => all.map((x, j) => (j === i ? result.marking : x)))
      setGrades((all) => all.map((x, j) => (j === i ? result.grade : x)))
    })

  const item = items[current]!
  const isChecked = checked[current]
  const last = current === total - 1

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="min-w-0 space-y-4">
        <Card className="p-5">
          <QuizQuestion
            item={item}
            index={current}
            response={responses[current] ?? null}
            onChange={isChecked ? undefined : (r) => update(current, r)}
            reveal={practice && isChecked}
          />
        </Card>

        {practice && isChecked && grades[current] && (
          <Reveal item={item} grade={grades[current]!} marking={markings[current] ?? null} onMark={(credit) => mark(current, credit)} />
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button onClick={() => setCurrent(current - 1)} disabled={current === 0}>
            上一題
          </Button>
          <div className="flex gap-2">
            {practice && !isChecked && (
              <Button variant="primary" onClick={check} disabled={pending}>
                {pending ? '檢查中…' : '看答案'}
              </Button>
            )}
            {(!practice || isChecked) && !last && (
              <Button variant={practice ? 'primary' : 'secondary'} onClick={() => setCurrent(current + 1)}>
                下一題
              </Button>
            )}
            {last && (!practice || isChecked) && (
              <Button variant="primary" onClick={() => (practice || confirm(confirmText(total - answeredCount))) && finish()} disabled={pending}>
                {practice ? '完成練習' : '交卷'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-20 lg:self-start">
        {attempt.deadline && !practice && <Countdown deadline={attempt.deadline} onEnd={finish} />}
        <Card className="p-3">
          <p className="mb-2 text-xs text-muted">
            {practice ? `已完成 ${checked.filter(Boolean).length} / ${total} 題` : `已作答 ${answeredCount} / ${total} 題`}
          </p>
          <div className="grid grid-cols-6 gap-1">
            {items.map((_, i) => {
              const g = grades[i]
              const tone =
                i === current
                  ? 'border-accent bg-accent text-white'
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
                <button key={i} type="button" onClick={() => setCurrent(i)} className={`h-8 rounded-md border text-xs tabular-nums ${tone}`}>
                  {i + 1}
                </button>
              )
            })}
          </div>
        </Card>
        {!practice && (
          <Button variant="primary" className="w-full" onClick={() => confirm(confirmText(total - answeredCount)) && finish()} disabled={pending}>
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

/** Time left in a timed exam; submits when it reaches zero. */
function Countdown({ deadline, onEnd }: { deadline: string; onEnd: () => void }) {
  const end = new Date(deadline).getTime()
  const [left, setLeft] = useState(() => end - Date.now())
  const ended = useRef(false)
  useEffect(() => {
    const timer = setInterval(() => {
      const ms = end - Date.now()
      setLeft(ms)
      if (ms <= 0 && !ended.current) {
        ended.current = true
        onEnd()
      }
    }, 500)
    return () => clearInterval(timer)
  }, [end, onEnd])
  const seconds = Math.max(0, Math.ceil(left / 1000))
  const text = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  return (
    <Card className={`p-3 text-center ${seconds <= 60 ? 'border-bad/40' : ''}`}>
      <p className="text-xs text-muted">剩餘時間</p>
      <p className={`text-2xl font-semibold tabular-nums ${seconds <= 60 ? 'text-bad' : ''}`}>{text}</p>
    </Card>
  )
}
