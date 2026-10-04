import { notFound } from 'next/navigation'
import { AssignForm } from '@/features/classes/AssignForm'
import { inClass } from '@/server/classes'
import { services } from '@/server/context'
import { intlTag } from '@/shared/i18n/locales'
import { getLocale, getT } from '@/shared/i18n/server'
import { ButtonLink, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const t = await getT()
  return { title: t('派作業') }
}

export default async function AssignPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ exam?: string }> }) {
  const [{ id }, { exam }] = await Promise.all([params, searchParams])
  const found = await inClass(id)
  const [t, locale] = await Promise.all([getT(), getLocale()])
  if (!found?.teaches) notFound()
  const { bank } = services()
  const exams = await bank.listExams({ ownerId: found.me.userId })

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('派作業')} subtitle={found.classroom.name} />
      {exams.length === 0 ? (
        <EmptyState title={t('題庫裡還沒有考卷')}>
          {t('先匯入一份考卷存進題庫，再回來派給班級。')}
          <div className="mt-4">
            <ButtonLink href="/imports" variant="primary">
              {t('匯入考卷')}
            </ButtonLink>
          </div>
        </EmptyState>
      ) : (
        <AssignForm
          classId={found.classroom.id}
          exams={exams.map((e) => ({ id: e.id, title: e.title ?? t('未命名考卷'), count: e.questionCount, hint: [e.subject, e.institution, e.term, t('{date} 加入', { date: new Date(e.createdAt).toLocaleDateString(intlTag(locale)) })].filter(Boolean).join(' · ') }))}
          preselected={exams.some((e) => e.id === exam) ? exam! : null}
        />
      )}
    </div>
  )
}
