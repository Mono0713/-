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
  pending: ['待自評', 'accent'],
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
    <div className="space-y-3 rounded-lg border border-line bg-paper p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{label}</Badge>
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
            <span>{answer}</span>
          ) : key.length === 1 ? (
            <Markdown>{key[0]!}</Markdown>
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

      {kind.kind === 'text' && key.length > 0 && onMark && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted">對照參考答案，你的答案：</span>
          <Button variant={self && self.credit >= 1 ? 'primary' : 'secondary'} onClick={() => onMark(self && self.credit >= 1 ? null : 1)}>
            答對
          </Button>
          <Button variant={self && self.credit <= 0 ? 'danger' : 'secondary'} onClick={() => onMark(self && self.credit <= 0 ? null : 0)}>
            答錯
          </Button>
        </div>
      )}

      {marking?.feedback && (
        <div>
          <span className="font-medium">{marking.by === 'ai' ? 'AI 老師評語：' : '評語：'}</span>
          <Markdown>{marking.feedback}</Markdown>
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
