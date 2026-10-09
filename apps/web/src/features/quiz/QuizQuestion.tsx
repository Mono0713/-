'use client'

import { optionFigures, questionFigures } from '@exam/core'
import { ESSAY_COLUMNS, isEmptyInk, practicePaper, type InkDoc, type Paper } from '@exam/ink'
import type { QuizItem, QuizResponse } from '@exam/quiz'
import { answerKind, matches, toPaperLabels, toQuizLabels } from '@exam/quiz/logic'
import { useState, type ReactNode } from 'react'
import { FigureView, OptionPictures } from '@/shared/FigureView'
import { useT } from '@/shared/i18n/client'
import { msg } from '@/shared/i18n/format'
import { fileUrl } from '@/shared/files'
import { InkPad } from '@/shared/ink/InkPad'
import { TYPE_LABELS, WORD_BANK_LABEL } from '@/shared/labels'
import { blankCount, Markdown } from '@/shared/Markdown'
import { withoutRule } from '@/shared/markingRule'
import { IconKeyboard, IconLanguages, IconLoader, IconPen, IconScratch } from '@/shared/icons'
import { PenTick } from '@/shared/motion/PenMarks'
import { Segmented } from '@/shared/Segmented'
import { BlankPick } from './BlankPick'
import { MatchingPicker } from './MatchingPicker'
import { Passage } from './Passage'
import { PracticeSheet } from './PracticeSheet'
import { useQuestionTranslation } from './useQuestionTranslation'
import { wordCount } from '@/shared/wordCount'
import { Badge, inputBase, inputClass } from '@/shared/ui'

function ModeLabel({ icon, text }: { icon: ReactNode; text: string }) {
  const t = useT()
  return <span className="flex items-center gap-1.5">{icon}{t(text)}</span>
}

const PAPERS = [
  ['dots', msg('點格')],
  ['lines', msg('橫線')],
  ['squares', msg('稿紙')],
] as const
type PaperKind = (typeof PAPERS)[number][0]
const paperOf = (kind: PaperKind): Paper => (kind === 'squares' ? { kind, columns: ESSAY_COLUMNS } : { kind })

// Kept outside the component: Segmented re-measures when its options change.
const ANSWER_MODES = [
  ['type', <ModeLabel key="type" icon={<IconKeyboard size={15} />} text={msg('打字')} />],
  ['ink', <ModeLabel key="ink" icon={<IconPen size={15} />} text={msg('手寫')} />],
] as const

/**
 * One question to answer. With `reveal`, the answer is locked and the key is
 * marked: a right pick in green, a right option not picked outlined, a wrong pick in red. Every question has a
 * scratch pad for working; open and fill-in questions can also be answered by hand.
 */
export function QuizQuestion({
  item,
  index,
  response,
  onChange,
  reveal = false,
  celebrate = false,
  locale,
  onTranslate,
  focus = false,
  groupRange,
  answerOnly = false,
}: {
  item: QuizItem
  index: number
  response: QuizResponse | null
  onChange?: (response: QuizResponse) => void
  reveal?: boolean
  /** Play the right / wrong feedback animation (when the answer has just been checked). */
  celebrate?: boolean
  /** The reader's language: a question in another language gets a 翻譯 button. */
  locale?: string
  /** Fetches the question in the reader's language (stem, then each option in stored order). */
  onTranslate?: () => Promise<{ stem: string; options: string[] } | { error: string }>
  /** 書寫模式: the writing area gets the room (a taller essay page, an enlarged practice grid on phones). */
  focus?: boolean
  /** First and last position of the questions sharing this question's passage. */
  groupRange?: [number, number] | null
  /** Only the written answer, without the question: one of many answers to the same question, read in a row. */
  answerOnly?: boolean
}) {
  const t = useT()
  const q = item.question
  const kind = answerKind(q)
  const values = response?.values ?? []
  const locked = reveal || !onChange
  const patch = (p: Partial<QuizResponse>) => onChange?.({ ...response, values, ...p, transcribed: undefined })
  const set = (next: string[]) => patch({ values: next })
  const setAt = (i: number, v: string, count: number) => set(Array.from({ length: count }, (_, j) => (j === i ? v : (values[j] ?? ''))))
  const key = q.answer.values
  // 選詞填空: the word box shows once above, with the passage, so not again as this question's options
  const wordBank = Boolean(item.group?.options?.length)

  // Open and fill-in answers can be handwritten; the AI reads them into text when checked.
  // 配合題 and blanks filled from a list are answered by picking labels, never by hand.
  const pick = kind.kind === 'blanks' && kind.pick === true
  const writable = kind.kind === 'text' || (kind.kind === 'blanks' && !pick)
  const typed = values.some((v) => v.trim())
  const inked = !isEmptyInk(response?.handwriting)
  const [mode, setMode] = useState<'type' | 'ink'>(() => (inked && (response?.transcribed || !typed) ? 'ink' : 'type'))
  // 作圖題 is drawn on its figure, so it is always answered by hand.
  const drawOn = q.type === 'drawing' ? questionFigures(q).find((f) => f.image) : undefined
  const byHand = writable && (mode === 'ink' || q.type === 'drawing')
  // Writing replaces anything typed, so there is one answer to mark.
  const setInk = (handwriting: InkDoc) => patch({ handwriting, values: [] })
  // Compositions default to manuscript squares in Chinese, Japanese or Korean and ruled lines otherwise;
  // other long answers to ruled lines.
  const [paperKind, setPaperKind] = useState<PaperKind>(() =>
    q.type === 'composition'
      ? /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(q.stem)
        ? 'squares'
        : 'lines'
      : q.type === 'essay'
        ? 'lines'
        : 'dots',
  )
  const practice = kind.kind === 'writing' ? practicePaper(key) : null
  // 書寫模式 can fold the question away so the page has the room
  const [stemFolded, setStemFolded] = useState(false)
  const stemShown = !focus || !stemFolded
  const hasScratch = !isEmptyInk(response?.scratch)
  const [scratchOpen, setScratchOpen] = useState(() => !reveal && hasScratch)

  // Translation: only on request, so the question is read in its own language first.
  const { translatable, translationShown, translating, translateError, toggleTranslation, shownTranslation, optionTranslation } = useQuestionTranslation(q, locale, onTranslate)

  // One blank's control: a label list for blanks filled from a list, otherwise a box to type in.
  // Figure blanks fill their box on the figure; blanks in the text (___, also in tables) sit in the line.
  const blankControl = (slot: number, label: string, inline = false) => {
    if (kind.kind !== 'blanks') return null
    const control = pick ? (
      <BlankPick
        label={label}
        labels={item.displayLabels}
        value={values[slot] ?? ''}
        answer={reveal ? toQuizLabels(item, key[slot] ?? '') : null}
        locked={locked}
        onPick={(l) => setAt(slot, l, kind.count)}
      />
    ) : (
      <input
        autoComplete="off"
        // A handwritten answer is shown as written, with what the AI read below it.
        value={byHand ? '' : (values[slot] ?? '')}
        disabled={locked || byHand}
        onChange={(e) => setAt(slot, e.target.value, kind.count)}
        aria-label={t('空格 {label}', { label })}
        className={`h-full w-full rounded-sm border-2 bg-surface/90 px-1 text-center text-sm font-semibold text-accent outline-none focus:border-accent ${
          reveal ? (matches(key[slot] ?? '', toPaperLabels(item, values[slot] ?? '')) ? 'border-good' : 'border-bad/60') : 'border-accent/40'
        }`}
      />
    )
    return inline ? <span className={`relative mx-0.5 inline-block h-7 align-middle ${pick ? 'w-12' : 'w-28'}`}>{control}</span> : control
  }

  let figureOffset = 0
  const figures = questionFigures(q).filter((f) => f !== drawOn).map((f, i) => {
    const count = f.image?.blanks.length ?? 0
    const offset = figureOffset
    figureOffset += count
    const renderBlank = kind.kind === 'blanks' && count ? (label: string, k: number) => blankControl(offset + k, label) : undefined
    return <FigureView key={i} figure={f} renderBlank={renderBlank} />
  })
  // Blanks written in the text (___, in a sentence or a table cell) are answered where they stand
  // when there is one per remaining answer.
  const inline = kind.kind === 'blanks' && kind.count > kind.figureBlanks && blankCount(q.stem) === kind.count - kind.figureBlanks
  const stemBlank = inline && kind.kind === 'blanks' ? (k: number) => blankControl(kind.figureBlanks + k, String(kind.figureBlanks + k + 1), true) : undefined

  const choice = kind.kind === 'single' || kind.kind === 'multiple'
  // Options that are all pictures sit two to a row, so graphs can be compared side by side.
  const pictureOptions = q.options.length > 0 && q.options.every((o) => optionFigures(q, o.label).length > 0)
  const toggle = (label: string) => {
    if (kind.kind === 'single') return set(values[0] === label ? [] : [label])
    set(values.includes(label) ? values.filter((v) => v !== label) : [...values, label])
  }

  return (
    <div className="space-y-4">
      {!answerOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold tabular-nums">{t('第 {n} 題', { n: index + 1 })}</span>
          <Badge>{wordBank ? t(WORD_BANK_LABEL) : t(TYPE_LABELS[q.type])}</Badge>
          {kind.kind === 'multiple' && <Badge tone="accent">{t('可複選')}</Badge>}
          {q.points !== null && <Badge>{t('{n} 分', { n: q.points })}</Badge>}
          {q.maxLength ? <Badge>{t('限 {n} 字', { n: q.maxLength })}</Badge> : null}
          {q.markingRule?.trim() ? <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-xs text-ink/80">{q.markingRule.trim()}</span> : null}
          <span className="ml-auto" />
          {translatable && (
            <button
              type="button"
              onClick={toggleTranslation}
              aria-pressed={translationShown}
              className={`m-press flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${translationShown ? 'bg-ink text-paper' : 'text-muted hover:bg-ink/[0.06] hover:text-ink'}`}
            >
              {translating ? <IconLoader size={16} className="m-spin" aria-hidden /> : <IconLanguages size={16} />}
              {t('翻譯')}
            </button>
          )}
          {(!locked || hasScratch) && (
            <button
              type="button"
              onClick={() => setScratchOpen(!scratchOpen)}
              aria-expanded={scratchOpen}
              className={`m-press flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${scratchOpen ? 'bg-ink text-paper' : 'text-muted hover:bg-ink/[0.06] hover:text-ink'}`}
            >
              <IconScratch size={16} />
              {locked ? t('看草稿') : t('草稿')}
            </button>
          )}
        </div>
      )}

      {scratchOpen && (
        <div className="m-expand space-y-1.5">
          <p className="text-xs text-muted">{t('草稿紙：計算和筆記寫在這裡，不會拿來評分。')}</p>
          <InkPad label={t('草稿紙')} value={response?.scratch} onChange={locked ? undefined : (scratch) => patch({ scratch })} readOnly={locked} minHeight={0.6} />
        </div>
      )}

      {item.group && !answerOnly && <Passage group={item.group} range={groupRange ?? null} />}

      {answerOnly ? null : stemShown ? (
        <div className={focus ? 'flex items-start gap-2' : undefined}>
          <Markdown className={focus ? 'min-w-0 flex-1' : undefined} renderBlank={stemBlank}>{withoutRule(q.stem, q.markingRule)}</Markdown>
          {focus && (
            <button type="button" onClick={() => setStemFolded(true)} className="m-press shrink-0 rounded-md px-2 py-1 text-xs text-muted hover:bg-ink/[0.06] hover:text-ink">
              {t('收合題目')}
            </button>
          )}
        </div>
      ) : (
        <button type="button" onClick={() => setStemFolded(false)} className="m-press w-full truncate rounded-lg border border-dashed border-line px-3 py-1.5 text-left text-sm text-muted hover:text-ink">
          {t('展開題目')}
        </button>
      )}
      {translateError && <p className="m-shake rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{translateError}</p>}
      {shownTranslation && (
        <div className="m-expand border-l-2 border-line pl-3 text-muted">
          <Markdown>{shownTranslation.stem}</Markdown>
        </div>
      )}
      {!answerOnly && figures}

      {choice ? (
        <ul className={`grid gap-2 ${pictureOptions ? 'sm:grid-cols-2' : ''}`}>
          {item.optionOrder.map((label, i) => {
            const option = q.options.find((o) => o.label === label)
            const picked = values.includes(label)
            const correct = reveal && key.includes(label)
            const wrong = reveal && picked && !correct
            // A right option nobody picked is only outlined, so an unanswered paper never looks all right.
            const missed = correct && !picked
            const tone = correct && picked ? 'border-good bg-good-soft' : missed ? 'border-dashed border-good bg-surface' : wrong ? 'border-bad bg-bad-soft' : picked ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent/50'
            // feedback plays once when the answer is revealed: a wrong pick is nudged (its red tint says
            // the rest; a red-pen ring was too loud) and the right option gets its tick
            const feedback = !celebrate ? '' : correct && picked ? 'm-pop' : wrong ? 'm-nudge' : ''
            return (
              <li key={label}>
                <button type="button" disabled={locked} onClick={() => toggle(label)} className={`m-press relative flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left text-sm ${tone} ${feedback}`}>
                  <span className={`num shrink-0 font-semibold leading-relaxed ${picked ? 'text-accent' : 'text-muted'}`}>({item.displayLabels[i]})</span>
                  <span className="min-w-0 flex-1">
                    <Markdown>{option?.content ?? ''}</Markdown>
                    <OptionPictures figures={optionFigures(q, label)} />
                    {optionTranslation(label) && <Markdown className="m-expand text-muted">{optionTranslation(label)!}</Markdown>}
                  </span>
                  {/* Marks sit one line high, centred on the option's first line. */}
                  {correct && picked && (
                    <span className="flex h-[1.625em] shrink-0 items-center">
                      <PenTick size={20} />
                    </span>
                  )}
                  {missed && <span className="flex h-[1.625em] shrink-0 items-center text-xs font-medium text-good">{t('正確答案')}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      ) : q.options.length > 0 && !answerOnly && !wordBank ? (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {item.optionOrder.map((label, i) => (
            <li key={`${label}-${i}`} className="flex gap-2 rounded-lg bg-paper px-2.5 py-1.5 text-sm">
              <span className="num shrink-0 font-semibold leading-relaxed text-muted">({item.displayLabels[i]})</span>
              <span className="min-w-0 flex-1">
                <Markdown>{q.options.find((o) => o.label === label)?.content ?? ''}</Markdown>
                <OptionPictures figures={optionFigures(q, label)} />
                {optionTranslation(label) && <Markdown className="m-expand text-muted">{optionTranslation(label)!}</Markdown>}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {kind.kind === 'true_false' && (
        <div className="flex gap-2">
          {(
            [
              ['true', t('○ 是')],
              ['false', t('╳ 非')],
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
                  correct && picked ? 'border-good bg-good-soft text-good' : correct ? 'border-dashed border-good bg-surface text-good' : reveal && picked ? 'border-bad bg-bad-soft text-bad' : picked ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface'
                }`}
              >
                {text}
              </button>
            )
          })}
        </div>
      )}

      {q.type === 'drawing' && !locked && <p className="text-sm text-muted">{t('直接在圖上畫出答案。看答案或交卷時，AI 會看你畫的圖來批改。')}</p>}
      {writable && !locked && q.type !== 'drawing' && (
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={mode} options={ANSWER_MODES} onChange={setMode} />
          <span className="text-xs text-muted">
            {byHand
              ? typed
                ? t('開始手寫後，打好的答案會清掉。')
                : t('看答案或交卷時，AI 會把手寫讀成文字再批改。')
              : inked
                ? t('已經有手寫答案；有打字時以打字為準。')
                : null}
          </span>
        </div>
      )}

      {byHand && (
        <div className="space-y-2">
          {kind.kind === 'blanks' && !locked && <p className="text-sm text-muted">{t('依序寫下每一格的答案，前面標上 (1)、(2)…')}</p>}
          {(!locked || inked) && (
            <InkPad
              label={t('手寫答案')}
              value={response?.handwriting}
              onChange={locked ? undefined : setInk}
              readOnly={locked}
              minHeight={kind.kind === 'blanks' ? 0.3 : focus ? 1 : 0.4}
              paper={paperOf(paperKind)}
              backdrop={drawOn?.image ? { src: fileUrl(drawOn.image.file), aspect: drawOn.image.height / drawOn.image.width } : undefined}
              tools={
                kind.kind === 'text' && !drawOn && (
                  <>
                    <span className="mx-1 h-5 w-px bg-line" />
                    <span className="flex items-center gap-0.5" role="group" aria-label={t('紙張')}>
                      {PAPERS.map(([v, name]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setPaperKind(v)}
                          aria-pressed={paperKind === v}
                          className={`m-press h-8 rounded-lg px-2 text-xs ${paperKind === v ? 'bg-ink/[0.08] font-medium text-ink' : 'text-muted hover:bg-ink/[0.06] hover:text-ink'}`}
                        >
                          {t(name)}
                        </button>
                      ))}
                    </span>
                  </>
                )
              }
            />
          )}
          {reveal &&
            inked &&
            (response?.transcribed ? (
              <div className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                <p className="mb-1 text-xs text-muted">{t('AI 讀到的答案')}</p>
                {values.length > 1 ? (
                  <ol className="list-decimal pl-5">
                    {values.map((v, i) => (
                      <li key={i}>{v.trim() ? <Markdown>{v}</Markdown> : <span className="text-muted">{t('（空白）')}</span>}</li>
                    ))}
                  </ol>
                ) : (
                  <Markdown>{values[0] ?? ''}</Markdown>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted">{t('這份手寫答案還沒讀成文字。開啟 AI 批改後會自動讀取，也可以對照答案自己評分。')}</p>
            ))}
        </div>
      )}

      {practice && (
        <div className="space-y-2">
          {!locked && <p className="text-sm text-muted">{t('每一行先看第一格的字，描過淡色的字，再自己寫滿整行。')}</p>}
          {practice.rows.length ? (
            (!locked || inked) && <PracticeSheet paper={practice} value={response?.handwriting} onChange={locked ? undefined : setInk} readOnly={locked} focus={focus} />
          ) : (
            <p className="text-sm text-muted">{t('這題還沒有要練習的字，請到題庫編輯答案。')}</p>
          )}
          {reveal &&
            inked &&
            (response?.transcribed ? (
              <div className="rounded-lg border border-line bg-paper px-3 py-2 text-sm">
                <p className="mb-1 text-xs text-muted">{t('AI 讀到的字（? 是寫錯或認不出的字）')}</p>
                <ul className="flex flex-wrap gap-x-4 gap-y-1">
                  {practice.rows.map((char, i) => {
                    const read = values[i] ?? ''
                    const ok = read.length > 0 && Array.from(read).every((c) => c === char)
                    return (
                      <li key={i} className="flex items-baseline gap-1.5">
                        <span className="font-hand text-base">{char}</span>
                        <span className={ok ? 'text-good' : 'text-bad'}>{read || t('（空白）')}</span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-muted">{t('這份手寫答案還沒讀成文字。開啟 AI 批改後會自動讀取，也可以對照答案自己評分。')}</p>
            ))}
        </div>
      )}

      {pick && !inline && kind.kind === 'blanks' && kind.count > kind.figureBlanks && (
        <MatchingPicker
          count={kind.count}
          start={kind.figureBlanks}
          labels={item.displayLabels}
          values={values}
          answer={reveal ? key.map((v) => toQuizLabels(item, v)) : null}
          locked={locked}
          onPick={(slot, label) => setAt(slot, label, kind.count)}
        />
      )}

      {!byHand && !pick && !inline && kind.kind === 'blanks' && kind.count > kind.figureBlanks && (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: kind.count - kind.figureBlanks }, (_, k) => {
            const slot = kind.figureBlanks + k
            return (
              <label key={slot} className="flex items-center gap-2 text-sm">
                <span className="w-8 shrink-0 text-right text-xs text-muted">({slot + 1})</span>
                <input autoComplete="off" value={values[slot] ?? ''} disabled={locked} onChange={(e) => setAt(slot, e.target.value, kind.count)} className={inputClass} />
              </label>
            )
          })}
        </div>
      )}

      {!byHand && kind.kind === 'text' && (
        <textarea
          autoComplete="off"
          value={values[0] ?? ''}
          disabled={locked}
          onChange={(e) => set([e.target.value])}
          rows={focus ? 16 : 5}
          placeholder={t('寫下你的答案')}
          className={`${inputBase} w-full`}
        />
      )}
      {!byHand && kind.kind === 'text' && q.maxLength ? (
        <p className={`-mt-2 text-right text-xs tabular-nums ${wordCount(values[0] ?? '') > q.maxLength ? 'font-semibold text-bad' : 'text-muted'}`}>
          {t('{n} / {max} 字', { n: wordCount(values[0] ?? ''), max: q.maxLength })}
        </p>
      ) : !byHand && kind.kind === 'text' && (q.type === 'essay' || q.type === 'composition') ? (
        <p className="-mt-2 text-right text-xs tabular-nums text-muted">{t('{n} 字', { n: wordCount(values[0] ?? '') })}</p>
      ) : null}
    </div>
  )
}
