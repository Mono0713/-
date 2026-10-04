import { notFound } from 'next/navigation'
import { BankQuestionEditor } from '@/features/bank/BankQuestionEditor'
import { services } from '@/server/context'
import { ownedQuestion } from '@/server/owned'
import { getT } from '@/shared/i18n/server'
import { ButtonLink, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function BankQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const q = await ownedQuestion(id)
  if (!q) notFound()
  const t = await getT()
  const exam = await services().bank.getExam(q.examId)
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('第 {n} 題', { n: q.number })}
        subtitle={[q.subject, q.examTitle].filter(Boolean).join(' · ')}
        actions={
          <>
            <ButtonLink href={`/bank/exams/${q.examId}`}>{t('回考卷')}</ButtonLink>
          </>
        }
      />
      <BankQuestionEditor question={q} importId={exam?.importId ?? null} />
    </div>
  )
}
