import type { BankExam } from '@exam/bank'
import Link from 'next/link'
import { Badge } from '@/shared/ui'

/** One exam in the bank list. */
export function ExamCard({ exam }: { exam: BankExam }) {
  const details = [exam.institution, exam.term].filter(Boolean).join(' · ')
  return (
    <Link href={`/bank/exams/${exam.id}`} className="flex h-full flex-col rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent/50">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {exam.subject && <Badge tone="accent">{exam.subject}</Badge>}
        <Badge>{exam.questionCount} 題</Badge>
      </div>
      <p className="line-clamp-2 font-semibold leading-snug">{exam.title ?? '未命名考卷'}</p>
      {details && <p className="mt-1 text-sm text-muted">{details}</p>}
      <p className="mt-auto pt-3 text-xs text-muted">{new Date(exam.createdAt).toLocaleDateString('zh-TW')} 加入</p>
    </Link>
  )
}
