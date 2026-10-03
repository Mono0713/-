import type { BankExam } from '@exam/bank'
import Link from 'next/link'
import { Badge } from '@/shared/ui'
import { DeleteExamButton } from './DeleteExamButton'

/**
 * One exam in the bank list, drawn as a sheet. Its bottom-right corner rests slightly curled,
 * like the logo, and lifts on hover to show a link straight into practice; the corner itself is
 * that link too. The rest of the card opens the exam.
 */
export function ExamCard({ exam }: { exam: BankExam }) {
  const details = [exam.institution, exam.term].filter(Boolean).join(' · ')
  return (
    <div className="group m-curl-host m-lift relative flex h-full flex-col overflow-hidden rounded-2xl bg-surface p-5 shadow-sheet">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">{exam.subject ? <Badge tone="accent">{exam.subject}</Badge> : <Badge>未分類</Badge>}</div>
        <span className="flex shrink-0 items-baseline gap-1 text-muted">
          <span className="num text-[22px] leading-none text-ink">{exam.questionCount}</span>
          <span className="text-xs">題</span>
        </span>
      </div>
      {/* the title link covers the whole card; the practice link sits above it */}
      <Link href={`/bank/exams/${exam.id}`} className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-[-0.01em] outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-accent">
        {exam.title ?? '未命名考卷'}
      </Link>
      {details && <p className="mt-1 text-sm text-muted">{details}</p>}
      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        <span className="flex items-center gap-1 text-xs text-muted">
          {new Date(exam.createdAt).toLocaleDateString('zh-TW')} 加入
          <DeleteExamButton id={exam.id} title={exam.title ?? '未命名考卷'} />
        </span>
        {exam.questionCount > 0 && (
          <Link href={`/quiz/new?exam=${exam.id}`} className="m-curl-label relative z-10 mr-10 -mb-1 rounded-md px-1.5 py-1 text-[13px] font-bold text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent">
            開始練習 →
          </Link>
        )}
      </div>
      {/* the curled corner itself is a way into practice: it opens the mode choice for this exam */}
      {exam.questionCount > 0 ? (
        <Link href={`/quiz/new?exam=${exam.id}`} tabIndex={-1} aria-hidden className="m-curl" />
      ) : (
        <span aria-hidden className="m-curl pointer-events-none" />
      )}
    </div>
  )
}
