import Link from 'next/link'
import { BankFilters } from '@/features/bank/BankFilters'
import { ExamCard } from '@/features/bank/ExamCard'
import { SwipeDeleteExam } from '@/features/bank/SwipeDeleteExam'
import { QuestionView } from '@/features/questions/QuestionView'
import { currentOwner, services } from '@/server/context'
import { getT } from '@/shared/i18n/server'
import { IconQuiz, IconUpload } from '@/shared/icons'
import { Removable } from '@/shared/removal'
import { ButtonLink, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function BankPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const { bank } = services()
  const owner = await currentOwner()
  const t = await getT()
  const search = params.q?.trim() || undefined
  const subject = params.subject || undefined
  const [exams, matches, subjects] = await Promise.all([
    bank.listExams({ ownerId: owner, search, subject }),
    search ? bank.listQuestions({ ownerId: owner, search, subject, limit: 20 }) : null,
    bank.subjects(owner),
  ])
  const empty = !search && !subject && exams.length === 0

  return (
    <div>
      <PageHeader
        title={t('題庫')}
        subtitle={t('{n} 份考卷', { n: exams.length })}
        actions={
          <>
            <ButtonLink href="/quiz/new" icon={<IconQuiz size={16} />}>
              {t('開始測驗')}
            </ButtonLink>
            <ButtonLink href="/imports" variant="primary" icon={<IconUpload size={16} />}>
              {t('匯入考卷')}
            </ButtonLink>
          </>
        }
      />
      <BankFilters subjects={subjects} values={{ q: params.q, subject: params.subject }} />

      {exams.length === 0 ? (
        <EmptyState title={empty ? t('題庫還是空的') : t('沒有符合條件的考卷')}>
          {empty ? t('匯入考卷、校對後按「存入題庫」，考卷就會出現在這裡。') : t('換個關鍵字或篩選條件試試。')}
        </EmptyState>
      ) : (
        <ul className="m-stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {exams.map((exam) => (
            <Removable key={exam.id} id={exam.id}>
              <li>
                <SwipeDeleteExam id={exam.id}>
                  <ExamCard exam={exam} />
                </SwipeDeleteExam>
              </li>
            </Removable>
          ))}
        </ul>
      )}

      {matches && matches.total > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-muted">
            {matches.total > matches.items.length
              ? t('符合「{search}」的題目 · {total} 題（顯示前 {shown} 題）', { search: search ?? '', total: matches.total, shown: matches.items.length })
              : t('符合「{search}」的題目 · {total} 題', { search: search ?? '', total: matches.total })}
          </h2>
          <ul className="m-stagger grid grid-cols-1 gap-4 xl:grid-cols-2">
            {matches.items.map((q) => (
              <li key={q.id}>
                <Link href={`/bank/${q.id}`} className="m-lift block h-full rounded-2xl bg-surface shadow-sheet p-4">
                  <p className="mb-2 truncate text-xs text-muted">{q.examTitle ?? t('未命名考卷')}</p>
                  <QuestionView q={q} compact />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
