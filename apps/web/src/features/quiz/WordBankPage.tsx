'use client'

import type { Grade, QuizItem, QuizResponse } from '@exam/quiz'
import { useT } from '@/shared/i18n/client'
import { WORD_BANK_LABEL } from '@/shared/labels'
import { Badge } from '@/shared/ui'
import { Passage } from './Passage'
import { QuizQuestion } from './QuizQuestion'

/**
 * 選詞填空 on one page, as printed: the section heading, the word box once, then every sentence with its
 * blank in place. Each sentence is still its own question (numbered, saved and marked one by one).
 */
export function WordBankPage({
  items,
  from,
  responses,
  onChange,
  reveal,
}: {
  items: QuizItem[]
  /** Position of the first sentence in the quiz. */
  from: number
  responses: (QuizResponse | null)[]
  /** Changes the answer at a position in the quiz; none once the answers are shown. */
  onChange?: (index: number, response: QuizResponse) => void
  reveal: boolean
}) {
  const t = useT()
  const first = items[0]!
  const to = from + items.length - 1
  const points = items.reduce((sum, item) => sum + (item.question.points ?? 0), 0)
  const section = first.question.section?.trim()
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-lg font-semibold tabular-nums">{t('第 {from}–{to} 題', { from: from + 1, to: to + 1 })}</span>
        <Badge>{t(WORD_BANK_LABEL)}</Badge>
        {points > 0 && <Badge>{t('{n} 分', { n: points })}</Badge>}
      </div>
      {section && !first.group?.stem.includes(section) && <p className="text-sm font-medium text-muted">{section}</p>}
      {first.group && <Passage group={first.group} range={null} />}
      <ol className="space-y-2.5">
        {items.map((item, k) => (
          <li key={from + k}>
            <QuizQuestion
              item={item}
              index={from + k}
              response={responses[k] ?? null}
              onChange={onChange ? (r) => onChange(from + k, r) : undefined}
              reveal={reveal}
              inPage
            />
          </li>
        ))}
      </ol>
    </div>
  )
}

/** After a page of sentences is checked: how many are right and the score, in place of one reveal per sentence. */
export function PageScore({ grades }: { grades: Grade[] }) {
  const t = useT()
  const right = grades.filter((g) => g.status === 'correct').length
  const score = grades.reduce((sum, g) => sum + g.score, 0)
  const max = grades.reduce((sum, g) => sum + g.max, 0)
  return (
    <div className="m-expand flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper p-4 text-sm">
      <Badge tone={right === grades.length ? 'good' : right === 0 ? 'bad' : 'warn'}>{t('答對 {n} / {total} 題', { n: right, total: grades.length })}</Badge>
      {max > 0 && <span className="text-muted">{t('{score} / {max} 分', { score: Math.round(score * 100) / 100, max })}</span>}
    </div>
  )
}
