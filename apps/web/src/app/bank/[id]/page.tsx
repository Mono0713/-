import { notFound } from 'next/navigation'
import { BankQuestionEditor } from '@/features/bank/BankQuestionEditor'
import { currentOwner, services } from '@/server/context'
import { ButtonLink, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function BankQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { bank } = services()
  const q = bank.getQuestion(id)
  if (!q || q.ownerId !== currentOwner()) notFound()
  const exam = bank.getExam(q.examId)
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`第 ${q.number} 題`}
        subtitle={[q.subject, q.examTitle].filter(Boolean).join(' · ')}
        actions={
          <>
            <ButtonLink href={`/bank/exams/${q.examId}`}>回考卷</ButtonLink>
          </>
        }
      />
      <BankQuestionEditor question={q} importId={exam?.importId ?? null} />
    </div>
  )
}
