import { notFound } from 'next/navigation'
import { BankQuestionEditor } from '@/features/bank/BankQuestionEditor'
import { currentOwner, services } from '@/server/context'
import { ButtonLink, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function BankQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const q = services().bank.getQuestion(id)
  if (!q || q.ownerId !== currentOwner()) notFound()
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`第 ${q.number} 題`}
        subtitle={[q.subject, q.examTitle].filter(Boolean).join(' · ')}
        actions={
          <>
            {q.importId && <ButtonLink href={`/imports/${q.importId}`}>看原始考卷</ButtonLink>}
            <ButtonLink href="/bank">回題庫</ButtonLink>
          </>
        }
      />
      <BankQuestionEditor question={q} />
    </div>
  )
}
