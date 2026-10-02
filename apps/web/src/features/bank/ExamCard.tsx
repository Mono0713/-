import type { BankExam } from '@exam/bank'
import Link from 'next/link'
import { Badge } from '@/shared/ui'

/** One exam in the bank list, drawn as a sheet with a folded corner. */
export function ExamCard({ exam }: { exam: BankExam }) {
  const details = [exam.institution, exam.term].filter(Boolean).join(' · ')
  return (
    <Link href={`/bank/exams/${exam.id}`} className="m-lift m-press relative flex h-full flex-col overflow-hidden rounded-2xl bg-surface p-5 shadow-sheet">
      <span aria-hidden className="absolute right-0 top-0 h-7 w-7 rounded-bl-lg bg-[linear-gradient(to_bottom_left,var(--color-paper)_50%,var(--color-line)_50%)]" />
      <div className="mb-3 flex flex-wrap gap-1.5 pr-6">{exam.subject ? <Badge tone="accent">{exam.subject}</Badge> : <Badge>未分類</Badge>}</div>
      <p className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-[-0.01em]">{exam.title ?? '未命名考卷'}</p>
      {details && <p className="mt-1 text-sm text-muted">{details}</p>}
      <div className="mt-auto flex items-end justify-between gap-3 pt-6">
        <span className="text-xs text-muted">{new Date(exam.createdAt).toLocaleDateString('zh-TW')} 加入</span>
        <span className="flex items-baseline gap-1 text-muted">
          <span className="num text-[28px] leading-none text-ink">{exam.questionCount}</span>
          <span className="text-xs">題</span>
        </span>
      </div>
    </Link>
  )
}
