import type { BankExam } from '@exam/bank'
import Link from 'next/link'
import { getLocale, getT } from '@/shared/i18n/server'
import { intlTag } from '@/shared/i18n/locales'
import { IconArrowRight } from '@/shared/icons'
import { Badge } from '@/shared/ui'
import { DeleteExamButton } from './DeleteExamButton'

/**
 * One exam in the bank list, drawn as a sheet. Its bottom-right corner rests slightly curled,
 * like the logo, and lifts on hover to show a quiet 練習 link straight into practice; the corner itself is
 * that link too. The rest of the card opens the exam.
 */
export async function ExamCard({ exam }: { exam: BankExam }) {
  const [t, locale] = await Promise.all([getT(), getLocale()])
  const details = [exam.institution, exam.term].filter(Boolean).join(' · ')
  return (
    <div className="group m-curl-host m-lift relative flex h-full flex-col overflow-hidden rounded-2xl bg-surface p-5 shadow-sheet">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">{exam.subject ? <Badge tone="accent">{exam.subject}</Badge> : <Badge>{t('未分類')}</Badge>}</div>
        <span className="flex shrink-0 items-baseline gap-1 text-muted">
          <span className="num text-[22px] leading-none text-ink">{exam.questionCount}</span>
          <span className="text-xs">{t('題')}</span>
        </span>
      </div>
      {/* the title link covers the whole card; the practice link sits above it */}
      <Link href={`/bank/exams/${exam.id}`} className="line-clamp-2 text-[17px] font-semibold leading-snug tracking-[-0.01em] outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-accent">
        {exam.title ?? t('未命名考卷')}
      </Link>
      {details && <p className="mt-1 text-sm text-muted">{details}</p>}
      {/* one line, centred: the date and the trash share a baseline; the way into practice is quiet until the corner lifts */}
      <div className="mt-auto flex h-7 items-center justify-between gap-3 pt-0">
        <span className="flex items-center gap-1.5 text-xs leading-none text-muted">
          <span>{t('{date} 加入', { date: new Date(exam.createdAt).toLocaleDateString(intlTag(locale)) })}</span>
          <DeleteExamButton id={exam.id} title={exam.title ?? t('未命名考卷')} />
        </span>
        {exam.questionCount > 0 && (
          <Link href={`/quiz/new?exam=${exam.id}`} className="m-curl-label relative z-10 mr-10 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-accent">
            {t('練習')}
            <IconArrowRight size={13} />
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
