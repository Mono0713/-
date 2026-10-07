import { canTeach } from '@exam/classes'
import { AssignForm } from '@/features/classes/AssignForm'
import { currentOwner, services } from '@/server/context'
import { intlTag } from '@/shared/i18n/locales'
import { getLocale, getT } from '@/shared/i18n/server'
import { ButtonLink, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const t = await getT()
  return { title: t('派作業') }
}

/** Gives an exam to classes: from a class page (`?class=`) or from an exam in the bank (`?exam=`). */
export default async function AssignPage({ searchParams }: { searchParams: Promise<{ exam?: string; class?: string }> }) {
  const { exam, class: classId } = await searchParams
  const owner = await currentOwner()
  const [t, locale] = await Promise.all([getT(), getLocale()])
  const { bank, classes } = services()
  const [exams, mine] = await Promise.all([bank.listExams({ ownerId: owner }), classes.of(owner)])
  const taught = await Promise.all(
    mine.filter((m) => canTeach(m.role)).map(async ({ classroom }) => ({ id: classroom.id, name: classroom.name, students: (await classes.members(classroom.id)).filter((m) => m.role === 'student').length })),
  )
  const from = taught.find((c) => c.id === classId)

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('派作業')} subtitle={from?.name} />
      {taught.length === 0 ? (
        <EmptyState title={t('還沒有自己的班級')}>
          {t('先開一個班級，學生用加入碼加入後，就能把題庫裡的考卷派給他們。')}
          <div className="mt-4">
            <ButtonLink href="/classes" variant="primary">
              {t('開一個班級')}
            </ButtonLink>
          </div>
        </EmptyState>
      ) : exams.length === 0 ? (
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
          classes={taught}
          chosen={from ? [from.id] : []}
          exams={exams.map((e) => ({
            id: e.id,
            title: e.title ?? t('未命名考卷'),
            count: e.questionCount,
            subject: e.subject,
            hint: [e.institution, e.term, t('{date} 加入', { date: new Date(e.createdAt).toLocaleDateString(intlTag(locale)) })].filter(Boolean).join(' · '),
          }))}
          preselected={exams.some((e) => e.id === exam) ? exam! : null}
        />
      )}
    </div>
  )
}
