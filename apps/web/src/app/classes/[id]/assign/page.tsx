import { notFound } from 'next/navigation'
import { AssignForm } from '@/features/classes/AssignForm'
import { inClass } from '@/server/classes'
import { services } from '@/server/context'
import { ButtonLink, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: '派作業' }

export default async function AssignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ exam?: string }> }) {
  const [{ id }, { exam }] = await Promise.all([params, searchParams])
  const found = await inClass(id)
  if (!found?.teaches) notFound()
  const { bank } = services()
  const exams = await bank.listExams({ ownerId: found.me.userId })

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="派作業" subtitle={found.classroom.name} />
      {exams.length === 0 ? (
        <EmptyState title="題庫裡還沒有考卷">
          先匯入一份考卷存進題庫，再回來派給班級。
          <div className="mt-4">
            <ButtonLink href="/imports" variant="primary">
              匯入考卷
            </ButtonLink>
          </div>
        </EmptyState>
      ) : (
        <AssignForm
          classId={found.classroom.id}
          exams={exams.map((e) => ({ id: e.id, title: e.title ?? '未命名考卷', count: e.questionCount, hint: [e.subject, e.institution, e.term, `${new Date(e.createdAt).toLocaleDateString('zh-TW')} 加入`].filter(Boolean).join(' · ') }))}
          preselected={exams.some((e) => e.id === exam) ? exam! : null}
        />
      )}
    </div>
  )
}
