'use client'

import { sheetOf, type DraftExam } from '@exam/core'
import { FigureView } from '@/shared/FigureView'
import { Markdown } from '@/shared/Markdown'
import { markSymbols } from '@/shared/markSymbols'
import { splitNumber } from '@/shared/questionNumber'
import { SheetHeader } from './SheetHeader'
import { SheetQuestion, type SheetCopy } from './SheetQuestion'

export interface SheetBlock {
  key: string
  node: React.ReactNode
  keepWithNext?: boolean
  /** The question this block prints, so clicking it picks that question. */
  question?: number
}

/** The printed paper as blocks that never split across pages: header, section headings, shared passages, questions. */
export function sheetBlocks(
  draft: DraftExam,
  copy: SheetCopy,
  labels: { range: (from: string, to: string) => string },
  /** Given, each question's answer room can be dragged taller or shorter. */
  onSpace?: (index: number, lines: number) => void,
): SheetBlock[] {
  const blocks: SheetBlock[] = [{ key: 'header', node: <SheetHeader meta={draft.meta} sheet={sheetOf(draft)} /> }]
  draft.questions.forEach((q, index) => {
    const before = draft.questions[index - 1]
    if (q.section && q.section !== before?.section) {
      blocks.push({ key: `section-${index}`, keepWithNext: true, node: <h2 className="pt-1 font-bold">{markSymbols(q.section)}</h2> })
    }
    const group = q.groupId && q.groupId !== before?.groupId ? draft.groups.find((g) => g.id === q.groupId) : undefined
    if (group) {
      const parts = draft.questions.filter((x) => x.groupId === group.id)
      const numbers = parts.map((p) => splitNumber(p.number))
      // sub-questions of one number print under it; a passage for several questions is boxed and says which
      const main = numbers.every((n) => n.part !== null && n.main === numbers[0]!.main) ? numbers[0]!.main : null
      blocks.push({
        key: `group-${group.id}`,
        keepWithNext: true,
        question: index,
        node: (
          <div className={main ? 'flex gap-1.5' : 'sheet-passage'}>
            {main ? <span className="num shrink-0 font-semibold">{main}.</span> : <p className="mb-1 text-[0.85em] font-semibold">{labels.range(parts[0]!.number, parts.at(-1)!.number)}</p>}
            <div className="min-w-0 flex-1 space-y-1.5">
              <Markdown>{group.stem}</Markdown>
              {group.figures.map((f, i) => (
                <FigureView key={i} figure={f} />
              ))}
            </div>
          </div>
        ),
      })
    }
    const inGroup = q.groupId !== null && draft.groups.some((g) => g.id === q.groupId)
    blocks.push({
      key: `q-${index}`,
      question: index,
      node: (
        <div className={inGroup && splitNumber(q.number).part ? 'pl-5' : ''}>
          <SheetQuestion q={q} copy={copy} onSpace={onSpace && ((lines) => onSpace(index, lines))} />
        </div>
      ),
    })
  })
  return blocks
}
