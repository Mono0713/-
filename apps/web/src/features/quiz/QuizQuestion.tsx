'use client'

import { isEmptyInk, type InkDoc } from '@exam/ink'
import type { QuizItem, QuizResponse } from '@exam/quiz'
import { answerKind, matches, toPaperLabels } from '@exam/quiz/logic'
import { useState } from 'react'
import { FigureView } from '@/shared/FigureView'
import { InkPad } from '@/shared/ink/InkPad'
import { TYPE_LABELS } from '@/shared/labels'
import { Markdown } from '@/shared/Markdown'
import { IconKeyboard, IconPen, IconScratch } from '@/shared/icons'
import { PenCircle, PenTick } from '@/shared/motion/PenMarks'
import { Segmented } from '@/shared/Segmented'
import { Badge, inputBase, inputClass } from '@/shared/ui'

// Kept outside the component: Segmented re-measures when its options change.
const ANSWER_MODES = [
  ['type', <span key="type" className="flex items-center gap-1.5"><IconKeyboard size={15} />打字</span>],
  ['ink', <span key="ink" className="flex items-center gap-1.5"><IconPen size={15} />手寫</span>],
] as const

/**
 * One question to answer. With `reveal`, the answer is locked and the key is
 * marked: correct options in green, a wrong pick in red. Every question has a
 * scratch pad for working; open and fill-in questions can also be answered by hand.
 */
export function QuizQuestion({
  item,
  index,
  response,
  onChange,
  reveal = false,
  celebrate = false,
}: {
  item: QuizItem
  index: number
  response: QuizResponse | null
  onChange?: (response: QuizResponse) => void
  reveal?: boolean
  /** Play the right / wrong feedback animation (when the answer has just been checked). */
  celebrate?: boolean
}) {
  const q = item.question
  const kind = answerKind(q)
  const values = response?.values ?? []
  const locked = reveal || !onChange
  const patch = (p: Partial<QuizResponse>) => onChange?.({ ...response, values, ...p, transcribed: undefined })
  const set = (next: string[]) => patch({ values: next })
  const setAt = (i: number, v: string, count: number) => set(Array.from({ length: count }, (_, j) => (j === i ? v : (values[j] ?? ''))))
  const key = q.answer.values

  // Open and fill-in answers can be handwritten; the AI reads them into text when checked.
  const writable = kind.kind === 'text' || kind.kind === 'blanks'
  const typed = values.some((v) => v.trim())
  const inked = !isEmptyInk(response?.handwriting)
  const [mode, setMode] = useState<'type' | 'ink'>(() => (inked && (response?.transcribed || !typed) ? 'ink' : 'type'))
  const byHand = writable && mode === 'ink'
  // Writing replaces anything typed, so there is one answer to mark.
  const setInk = (handwriting: InkDoc) => patch({ handwriting, values: [] })
  const hasScratch = !isEmptyInk(response?.scratch)
  const [scratchOpen, setScratchOpen] = useState(() => !reveal && hasScratch)

  let figureOffset = 0
  const figures = q.figures.map((f, i) => {
    const count = f.image?.blanks.length ?? 0
    const offset = figureOffset
    figureOffset += count
    const renderBlank =
      kind.kind === 'blanks' && count
        ? (_label: string, k: number) => {
            const slot = offset + k
            const right = reveal && matches(key[slot] ?? '', toPaperLabels(item, values[slot] ?? ''))
            return (
              <input
                // A handwritten answer is shown as written, with what the AI read below it.
                value={byHand ? '' : (values[slot] ?? '')}
                disabled={locked || byHand}
                onChange={(e) => kind.kind === 'blanks' && setAt(slot, e.target.value, kind.count)}
                aria-label={`空格 ${_label}`}
                className={`h-full w-full rounded-sm border-2 bg-surface/90 px-1 text-center text-sm font-semibold text-accent outline-none focus:border-accent ${
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
        {(!locked || hasScratch) && (
          <button
            type="button"
            onClick={() => setScratchOpen(!scratchOpen)}
            aria-expanded={scratchOpen}
            className={`m-press ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${scratchOpen ? 'bg-ink text-paper' : 'text-muted hover:bg-ink/[0.06] hover:text-ink'}`}
          >
            <IconScratch size={16} />
            {locked ? '看草稿' : '草稿'}
          </button>
        )}
      </div>

      {scratchOpen && (
        <div className="m-expand space-y-1.5">
          <p className="text-xs text-muted">草稿紙：計算和筆記寫在這裡，不會拿來評分。</p>
          <InkPad label="草稿紙" value={response?.scratch} onChange={locked ? undefined : (scratch) => patch({ scratch })} readOnly={locked} minHeight={0.6} />
        </div>
      )}

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
            const wrong = reveal && picked && !correct
            const tone = correct ? 'border-good bg-good-soft' : wrong ? 'border-bad bg-bad-soft' : picked ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent/50'
            // feedback plays once when the answer is revealed: a wrong pick is circled in red pen and
            // nudged, then the right option gets its tick
            const feedback = !celebrate ? '' : correct && picked ? 'm-pop' : wrong ? 'm-nudge' : ''
            return (
              // the red ring reaches past the option's box, so that option sits above the ones after it
              <li key={label} className={wrong ? 'relative z-10' : undefined}>
                <button type="button" disabled={locked} onClick={() => toggle(label)} className={`m-press relative flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm ${tone} ${feedback}`}>
                  <span className={`num shrink-0 font-semibold leading-relaxed ${picked ? 'text-accent' : 'text-muted'}`}>({item.displayLabels[i]})</span>
                  <Markdown className="min-w-0 flex-1">{option?.content ?? ''}</Markdown>
                  {/* Marks sit one line high, centred on the option's first line. */}
                  {correct && (
                    <span className="flex h-[1.625em] shrink-0 items-center">
                      <PenTick size={20} late={values.some((v) => !key.includes(v))} />
                    </span>
                  )}
                  {wrong && <PenCircle />}
                </button>
              </li>
            )
          })}
        </ul>
      ) : q.options.length > 0 ? (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {item.optionOrder.map((label, i) => (
            <li key={`${label}-${i}`} className="flex gap-2 rounded-lg bg-paper px-2.5 py-1.5 text-sm">
              <span className="num shrink-0 font-semibold leading-relaxed text-muted">({item.displayLabels[i]})</span>
              <Markdown className="min-w-0 flex-1">{q.options.find((o) => o.label === label)?.content ?? ''}</Markdown>
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

      {writable && !locked && (
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={mode} options={ANSWER_MODES} onChange={setMode} />
          <span className="text-xs text-muted">
            {byHand
              ? typed
                ? '開始手寫後，打好的答案會清掉。'
                : '看答案或交卷時，AI 會把手寫讀成文字再批改。'
              : inked
                ? '已經有手寫答案；有打字時以打字為準。'
                : null}
          </span>
        </div>
      )}

      {byHand && (
        <div className="space-y-2">
          {kind.kind === 'blanks' && !locked && <p className="text-sm text-muted">依序寫下每一格的答案，前面標上 (1)、(2)…</p>}
          {(!locked || inked) && (
            <InkPad label="手寫答案" value={response?.handwriting} onChange={locked ? undefined : setInk} readOnly={locked} minHeight={kind.kind === 'blanks' ? 0.3 : 0.4} />
          )}
          {reveal &&
            inked &&
            (response?.transcribed ? (
              <div className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                <p className="mb-1 text-xs text-muted">AI 讀到的答案</p>
                {values.length > 1 ? (
                  <ol className="list-decimal pl-5">
                    {values.map((v, i) => (
                      <li key={i}>{v.trim() ? <Markdown>{v}</Markdown> : <span className="text-muted">（空白）</span>}</li>
                    ))}
                  </ol>
                ) : (
                  <Markdown>{values[0] ?? ''}</Markdown>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted">這份手寫答案還沒讀成文字。開啟 AI 批改後會自動讀取，也可以對照答案自己評分。</p>
            ))}
        </div>
      )}

      {!byHand && kind.kind === 'blanks' && kind.count > kind.figureBlanks && (
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

      {!byHand && kind.kind === 'text' && (
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
