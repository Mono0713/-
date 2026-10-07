'use client'

import { optionFigures, questionFigures, type DraftQuestion } from '@exam/core'
import { matchingParts } from '@/features/questions/MatchingTable'
import { FigureView, OptionPictures } from '@/shared/FigureView'
import { useT } from '@/shared/i18n/client'
import { Markdown } from '@/shared/Markdown'
import { splitNumber } from '@/shared/questionNumber'
import { AnswerRoom } from './AnswerRoom'
import { optionColumns } from './layout'

/** 學生版 leaves the answers out; 教師版 writes them in red, where the student would. */
export type SheetCopy = 'student' | 'teacher'

const COLUMNS = { 1: 'grid-cols-1', 2: 'grid-cols-2', 4: 'grid-cols-4' } as const

/** Types answered in sentences get ruled lines; the rest (working out, drawing) get blank room. */
const RULED = new Set<DraftQuestion['type']>(['short_answer', 'essay', 'composition', 'other'])
/** Writing room by type, in lines: what a teacher would leave on paper; other types get none until it is dragged out. */
const LINES: Partial<Record<DraftQuestion['type'], number>> = { short_answer: 3, calculation: 8, essay: 8, composition: 16, other: 2 }

/**
 * One question as printed on paper: the answer bracket for choices, the number, the text with its blanks
 * as lines, pictures, options set in columns by their length, and room to write for open questions.
 */
export function SheetQuestion({ q, copy, onSpace }: { q: DraftQuestion; copy: SheetCopy; onSpace?: (lines: number) => void }) {
  const t = useT()
  const teacher = copy === 'teacher'
  const { main, part } = splitNumber(q.number)
  const bracketed = q.type === 'single_choice' || q.type === 'multiple_choice' || q.type === 'true_false'
  const values = q.answer.values.filter((v) => v.trim())
  const bracketAnswer = q.type === 'true_false' ? values.map((v) => (v === 'true' ? '○' : v === 'false' ? '╳' : v)).join('') : values.join('')
  const matching = q.type === 'matching' ? matchingParts(q.stem) : null
  const figures = questionFigures(q)
  // fill-in answers go into the text's own blanks; with no blank in the text they get a line underneath
  const inlineBlank = (i: number) => <span className="sheet-blank">{teacher && q.type === 'fill_in_blank' ? <span className="sheet-key">{values[i] ?? ''}</span> : null}</span>
  const body = matching && matching.items.length ? matching.lead : q.stem
  const pictures = q.options.some((o) => optionFigures(q, o.label).length > 0)
  // the room to answer in: the person's own size (dragged on the preview), else what the type usually gets
  const lines = q.space ?? LINES[q.type] ?? 0
  const key = teacher && values.length && (LINES[q.type] !== undefined || q.type === 'drawing') ? values.join('\n\n') : null

  return (
    <div className="flex gap-1.5">
      {bracketed && <span className="sheet-bracket">{teacher ? <span className="sheet-key">{bracketAnswer}</span> : null}</span>}
      <span className="num shrink-0 font-semibold">{part ? `(${part})` : `${main}.`}</span>
      <div className="min-w-0 flex-1 space-y-1.5">
        {body && <Markdown renderBlank={inlineBlank}>{body}</Markdown>}

        {figures.map((f, i) => (
          <FigureView key={i} figure={f} renderBlank={(label) => <span className="sheet-figure-blank">{label}</span>} />
        ))}

        {matching && matching.items.length > 0 && (
          <ol className="space-y-1">
            {matching.items.map((item, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="sheet-bracket">{teacher ? <span className="sheet-key">{values[i] ?? ''}</span> : null}</span>
                <Markdown className="min-w-0 flex-1">{item}</Markdown>
              </li>
            ))}
          </ol>
        )}

        {q.options.length > 0 && (
          <ul className={`grid gap-x-4 gap-y-1 ${COLUMNS[optionColumns(q.options, pictures)]}`}>
            {q.options.map((o, i) => (
              <li key={`${o.label}-${i}`} className="flex min-w-0 gap-1">
                <span className="num shrink-0">({o.label})</span>
                <span className="min-w-0 flex-1">
                  <Markdown>{o.content}</Markdown>
                  <OptionPictures figures={optionFigures(q, o.label)} />
                </span>
              </li>
            ))}
          </ul>
        )}

        {q.type === 'fill_in_blank' && !body.match(/_{3,}/) && <AnswerLine label={t('答：')} answer={teacher ? values.join('、') : null} />}
        {q.type === 'writing' && <WritingGrid characters={values.join('')} />}
        <AnswerRoom lines={lines} ruled={RULED.has(q.type)} onResize={onSpace}>
          {key && <Key>{key}</Key>}
        </AnswerRoom>
      </div>
      {/* choices take their points from the section heading, as on paper; open questions say their own */}
      {q.points !== null && !bracketed && <span className="shrink-0 pl-2 text-[0.85em] text-ink/70">{t('（{points} 分）', { points: q.points })}</span>}
    </div>
  )
}

function AnswerLine({ label, answer }: { label: string; answer: string | null }) {
  return (
    <p className="flex items-end gap-1">
      <span>{label}</span>
      <span className="sheet-blank !w-auto flex-1">{answer ? <span className="sheet-key">{answer}</span> : null}</span>
    </p>
  )
}

/** The answer key on 教師版, in red. */
function Key({ children }: { children: string }) {
  return <Markdown className="sheet-key">{children}</Markdown>
}

/** 寫字練習: a row of squares per character, the first holding it in pale ink to trace. */
function WritingGrid({ characters }: { characters: string }) {
  const chars = [...characters.replace(/\s/g, '')].slice(0, 8)
  return (
    <div className="space-y-1">
      {(chars.length ? chars : ['']).map((c, i) => (
        <div key={i} className="flex">
          {Array.from({ length: 10 }, (_, k) => (
            <span key={k} className="sheet-square">
              {k === 0 ? c : ''}
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}
