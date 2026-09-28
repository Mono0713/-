'use client'

import type { QuizItem, QuizResponse } from '@exam/quiz'
import { answerKind, matches } from '@exam/quiz/logic'
import { FigureView } from '@/shared/FigureView'
import { TYPE_LABELS } from '@/shared/labels'
import { Markdown } from '@/shared/Markdown'
import { Badge, inputBase, inputClass } from '@/shared/ui'

/**
 * One question to answer. With `reveal`, the answer is locked and the key is
 * marked: correct options in green, a wrong pick in red.
 */
export function QuizQuestion({
  item,
  index,
  response,
  onChange,
  reveal = false,
}: {
  item: QuizItem
  index: number
  response: QuizResponse | null
  onChange?: (response: QuizResponse) => void
  reveal?: boolean
}) {
  const q = item.question
  const kind = answerKind(q)
  const values = response?.values ?? []
  const locked = reveal || !onChange
  const set = (next: string[]) => onChange?.({ values: next })
  const setAt = (i: number, v: string, count: number) => set(Array.from({ length: count }, (_, j) => (j === i ? v : (values[j] ?? ''))))
  const key = q.answer.values

  let figureOffset = 0
  const figures = q.figures.map((f, i) => {
    const count = f.image?.blanks.length ?? 0
    const offset = figureOffset
    figureOffset += count
    const renderBlank =
      kind.kind === 'blanks' && count
        ? (_label: string, k: number) => {
            const slot = offset + k
            const right = reveal && matches(key[slot] ?? '', values[slot] ?? '')
            return (
              <input
                value={values[slot] ?? ''}
                disabled={locked}
                onChange={(e) => kind.kind === 'blanks' && setAt(slot, e.target.value, kind.count)}
                aria-label={`空格 ${_label}`}
                className={`h-full w-full rounded-sm border-2 bg-white/90 px-1 text-center text-sm font-semibold text-accent outline-none focus:border-accent ${
                  reveal ? (right ? 'border-good' : 'border-bad/60') : 'border-accent/40'
                }`}
              />
            )
          }
        : undefined
    return <FigureView key={i} figure={f} renderBlank={renderBlank} />
  })

  const choice = kind.kind === 'single' || kind.kind === 'multiple'
  const toggle = (label: string) => {
    if (kind.kind === 'single') return set(values[0] === label ? [] : [label])
    set(values.includes(label) ? values.filter((v) => v !== label) : [...values, label])
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold tabular-nums">第 {index + 1} 題</span>
        <Badge>{TYPE_LABELS[q.type]}</Badge>
        {kind.kind === 'multiple' && <Badge tone="accent">可複選</Badge>}
        {q.points !== null && <Badge>{q.points} 分</Badge>}
      </div>

      {item.group && (
        <div className="rounded-lg border border-line bg-paper p-3">
          <Markdown>{item.group.stem}</Markdown>
          {item.group.figures.map((f, i) => (
            <FigureView key={i} figure={f} />
          ))}
        </div>
      )}

      <Markdown>{q.stem}</Markdown>
      {figures}

      {choice ? (
        <ul className="grid gap-2">
          {item.optionOrder.map((label, i) => {
            const option = q.options.find((o) => o.label === label)
            const picked = values.includes(label)
            const correct = reveal && key.includes(label)
            const tone = correct ? 'border-good bg-good-soft' : reveal && picked ? 'border-bad bg-bad-soft' : picked ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent/50'
            return (
              <li key={label}>
                <button type="button" disabled={locked} onClick={() => toggle(label)} className={`flex w-full gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${tone}`}>
                  <span className={`font-semibold ${picked ? 'text-accent' : 'text-muted'}`}>({item.displayLabels[i]})</span>
                  <Markdown className="min-w-0 flex-1">{option?.content ?? ''}</Markdown>
                </button>
              </li>
            )
          })}
        </ul>
      ) : q.options.length > 0 ? (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {q.options.map((o, i) => (
            <li key={`${o.label}-${i}`} className="flex gap-2 rounded-lg bg-paper px-2.5 py-1.5 text-sm">
              <span className="font-semibold text-muted">({o.label})</span>
              <Markdown className="min-w-0 flex-1">{o.content}</Markdown>
            </li>
          ))}
        </ul>
      ) : null}

      {kind.kind === 'true_false' && (
        <div className="flex gap-2">
          {(
            [
              ['true', '○ 是'],
              ['false', '╳ 非'],
            ] as const
          ).map(([v, text]) => {
            const picked = values[0] === v
            const correct = reveal && key[0] === v
            return (
              <button
                key={v}
                type="button"
                disabled={locked}
                onClick={() => set(picked ? [] : [v])}
                className={`rounded-lg border px-5 py-2 text-sm font-medium ${
                  correct ? 'border-good bg-good-soft text-good' : reveal && picked ? 'border-bad bg-bad-soft text-bad' : picked ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface'
                }`}
              >
                {text}
              </button>
            )
          })}
        </div>
      )}

      {kind.kind === 'blanks' && kind.count > kind.figureBlanks && (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: kind.count - kind.figureBlanks }, (_, k) => {
            const slot = kind.figureBlanks + k
            return (
              <label key={slot} className="flex items-center gap-2 text-sm">
                <span className="w-8 shrink-0 text-right text-xs text-muted">({slot + 1})</span>
                <input value={values[slot] ?? ''} disabled={locked} onChange={(e) => setAt(slot, e.target.value, kind.count)} className={inputClass} />
              </label>
            )
          })}
        </div>
      )}

      {kind.kind === 'text' && (
        <textarea
          value={values[0] ?? ''}
          disabled={locked}
          onChange={(e) => set([e.target.value])}
          rows={5}
          placeholder="寫下你的答案"
          className={`${inputBase} w-full`}
        />
      )}
    </div>
  )
}
