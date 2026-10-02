'use client'

import type { Grade, Marking, QuizItem } from '@exam/quiz'
import { answerKind, displayLabel, toQuizLabels } from '@exam/quiz/logic'
import { Markdown } from '@/shared/Markdown'
import { Badge, Button } from '@/shared/ui'

export const GRADE_LABELS = {
  correct: ['答對', 'good'],
  partial: ['部分正確', 'warn'],
  wrong: ['答錯', 'bad'],
  unanswered: ['未作答', 'neutral'],
  pending: ['待批改', 'accent'],
  no_key: ['沒有標準答案', 'neutral'],
} as const

/** The answer key, explanation and translation shown after a question is answered. */
export function Reveal({
  item,
  grade,
  marking,
  onMark,
}: {
  item: QuizItem
  grade: Grade
  marking: Marking | null
  /** Marks an open answer yourself: 1 right, 0 wrong, null to clear. */
  onMark?: (credit: number | null) => void
}) {
  const q = item.question
  const kind = answerKind(q)
  const self = marking?.by === 'self' ? marking : null
  const [label, tone] = GRADE_LABELS[grade.status]
  // Blanks answered with option labels show them as labelled in this quiz.
  const key = kind.kind === 'blanks' ? q.answer.values.map((v) => toQuizLabels(item, v)) : q.answer.values
  const answer =
    kind.kind === 'single' || kind.kind === 'multiple'
      ? key.map((l) => displayLabel(item, l)).join('、')
      : kind.kind === 'true_false'
        ? key[0] === 'true'
          ? '○ 是'
          : '╳ 非'
        : null

  return (
    <div className="m-expand space-y-3 rounded-lg border border-line bg-paper p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{label}</Badge>
        {marking?.by === 'ai' && <Badge tone="accent">AI 批改</Badge>}
        {grade.max > 0 && (
          <span className="text-muted">
            {grade.score} / {grade.max} 分
          </span>
        )}
      </div>

      {key.length > 0 && (
        <div>
          <span className="font-medium text-good">正確答案：</span>
          {answer !== null ? (
            <span className="hl m-sweep">{answer}</span>
          ) : key.length === 1 ? (
            <Markdown className="hl-md m-sweep">{key[0]!}</Markdown>
          ) : (
            <ol className="list-decimal pl-5">
              {key.map((v, i) => (
                <li key={i}>
                  <Markdown>{v}</Markdown>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {/* Anything but a choice question can be marked by hand, also over the AI teacher's mark. */}
      {kind.kind !== 'single' && kind.kind !== 'multiple' && kind.kind !== 'true_false' && grade.status !== 'unanswered' && onMark && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted">
            {marking?.by === 'ai' ? 'AI 老師批改的。不同意的話可以自己改：' : key.length ? '對照參考答案，你的答案：' : '這題沒有標準答案，你的答案：'}
          </span>
          <Button className="px-3 py-1.5" variant={self && self.credit >= 1 ? 'primary' : 'secondary'} onClick={() => onMark(self && self.credit >= 1 ? null : 1)}>
            答對
          </Button>
          <Button className="px-3 py-1.5" variant={self && self.credit <= 0 ? 'danger' : 'secondary'} onClick={() => onMark(self && self.credit <= 0 ? null : 0)}>
            答錯
          </Button>
        </div>
      )}

      {marking?.feedback && (
        <div>
          <span className="font-medium">{marking.by === 'ai' ? 'AI 老師評語：' : '評語：'}</span>
          {/* the teacher's comment is written in red pen */}
          <Markdown className="pen">{marking.feedback}</Markdown>
        </div>
      )}

      {q.explanation && (
        <div>
          <span className="font-medium">詳解：</span>
          <Markdown>{q.explanation}</Markdown>
        </div>
      )}
      {q.translation && (
        <div>
          <span className="font-medium">翻譯：</span>
          <Markdown className="text-muted">{q.translation}</Markdown>
        </div>
      )}
    </div>
  )
}
