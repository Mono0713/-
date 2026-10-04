'use client'

import type { Grade, Marking, QuizItem, TutorTurn } from '@exam/quiz'
import { answerKind, displayLabel, toQuizLabels } from '@exam/quiz/logic'
import { useT } from '@/shared/i18n/client'
import { msg } from '@/shared/i18n/format'
import { Markdown } from '@/shared/Markdown'
import { Badge, Button } from '@/shared/ui'
import { TutorChat } from './TutorChat'

export const GRADE_LABELS = {
  correct: [msg('答對'), 'good'],
  partial: [msg('部分正確'), 'warn'],
  wrong: [msg('答錯'), 'bad'],
  unanswered: [msg('未作答'), 'neutral'],
  pending: [msg('待批改'), 'accent'],
  no_key: [msg('沒有標準答案'), 'neutral'],
} as const

/** The answer key and explanation shown after a question is answered; the translation is on the question's own 翻譯 button. */
export function Reveal({
  item,
  grade,
  marking,
  onMark,
  withheldNote,
  tutor,
}: {
  item: QuizItem
  grade: Grade
  marking: Marking | null
  /** Marks an open answer yourself: 1 right, 0 wrong, null to clear. */
  onMark?: (credit: number | null) => void
  /** Said in place of the answer key when it is not shown. */
  withheldNote?: string
  /** Offers the AI tutor for this question, with the conversation so far. */
  tutor?: { attemptId: string; index: number; turns: TutorTurn[]; onTurns?: (turns: TutorTurn[]) => void }
}) {
  const t = useT()
  const q = item.question
  const kind = answerKind(q)
  const self = marking?.by === 'self' ? marking : null
  const [label, tone] = GRADE_LABELS[grade.status]
  // Blanks answered with option labels show them as labelled in this quiz.
  const key = kind.kind === 'blanks' ? q.answer.values.map((v) => toQuizLabels(item, v)) : q.answer.values
  const withheld = q.answer.values.length > 0 && q.answer.values.every((v) => v === '')
  // A choice is shown as on the paper, label and text: "(2) X-ray crystallography".
  const choices =
    kind.kind === 'single' || kind.kind === 'multiple'
      ? key.map((l) => ({ label: displayLabel(item, l), content: q.options.find((o) => o.label === l)?.content ?? '' }))
      : null
  const answer = kind.kind === 'true_false' ? (key[0] === 'true' ? t('○ 是') : t('╳ 非')) : null

  return (
    <div className="m-expand space-y-3 rounded-lg border border-line bg-paper p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{t(label)}</Badge>
        {marking?.by === 'ai' && <Badge tone="accent">{t('AI 批改')}</Badge>}
        {marking?.by === 'teacher' && <Badge tone="accent">{t('老師批改')}</Badge>}
        {grade.max > 0 && (
          <span className="text-muted">
            {t('{score} / {max} 分', { score: grade.score, max: grade.max })}
          </span>
        )}
      </div>

      {/* A shared exam whose owner keeps the key private sends empty answers. */}
      {withheld && <p className="text-muted">{withheldNote ?? t('分享這份考卷的人沒有公開答案。')}</p>}

      {/* a writing practice shows its characters in the grid already */}
      {key.length > 0 && !withheld && kind.kind !== 'writing' && (
        <div className={choices?.length === 1 ? 'flex items-baseline' : undefined}>
          <span className="shrink-0 font-medium text-good">{t('正確答案：')}</span>
          {choices ? (
            // one answer stays on the line, several go one per line below
            <ul className={choices.length === 1 ? 'min-w-0' : 'mt-1 space-y-1'}>
              {choices.map((c) => (
                <li key={c.label} className="flex items-baseline gap-2">
                  <span className="num shrink-0 font-semibold">({c.label})</span>
                  {c.content.trim() ? <Markdown className="hl-md m-sweep min-w-0">{c.content}</Markdown> : null}
                </li>
              ))}
            </ul>
          ) : answer !== null ? (
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
      {kind.kind !== 'single' && kind.kind !== 'multiple' && kind.kind !== 'true_false' && !(kind.kind === 'blanks' && kind.pick) && grade.status !== 'unanswered' && onMark && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted">
            {marking?.by === 'ai' ? t('AI 老師批改的。不同意的話可以自己改：') : withheld ? t('答案沒有公開，你的答案：') : key.length ? t('對照參考答案，你的答案：') : t('這題沒有標準答案，你的答案：')}
          </span>
          <Button className="px-3 py-1.5" variant={self && self.credit >= 1 ? 'primary' : 'secondary'} onClick={() => onMark(self && self.credit >= 1 ? null : 1)}>
            {t('答對')}
          </Button>
          <Button className="px-3 py-1.5" variant={self && self.credit <= 0 ? 'danger' : 'secondary'} onClick={() => onMark(self && self.credit <= 0 ? null : 0)}>
            {t('答錯')}
          </Button>
        </div>
      )}

      {marking?.feedback && (
        <div>
          <span className="font-medium">{marking.by === 'ai' ? t('AI 老師評語：') : marking.by === 'teacher' ? t('老師評語：') : t('評語：')}</span>
          {/* the teacher's comment is written in red pen */}
          <Markdown className="pen">{marking.feedback}</Markdown>
        </div>
      )}

      {q.explanation && (
        <div>
          <span className="font-medium">{t('詳解：')}</span>
          <Markdown>{q.explanation}</Markdown>
        </div>
      )}

      {/* The tutor would give a hidden answer away. */}
      {tutor && !withheld && <TutorChat key={tutor.index} {...tutor} />}
    </div>
  )
}
