import Link from 'next/link'
import { BankFilters } from '@/features/bank/BankFilters'
import { ExamCard } from '@/features/bank/ExamCard'
import { QuestionView } from '@/features/questions/QuestionView'
import { currentOwner, services } from '@/server/context'
import { ButtonLink, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function BankPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const { bank } = services()
  const owner = currentOwner()
  const search = params.q?.trim() || undefined
  const subject = params.subject || undefined
  const exams = bank.listExams({ ownerId: owner, search, subject })
  const matches = search ? bank.listQuestions({ ownerId: owner, search, subject, limit: 20 }) : null
  const empty = !search && !subject && exams.length === 0

  return (
    <div>
      <PageHeader
        title="題庫"
        subtitle={`${exams.length} 份考卷`}
        actions={
          <>
            <ButtonLink href="/quiz/new">開始測驗</ButtonLink>
            <ButtonLink href="/imports" variant="primary">
              匯入考卷
            </ButtonLink>
          </>
        }
      />
      <BankFilters subjects={bank.subjects(owner)} values={{ q: params.q, subject: params.subject }} />

      {exams.length === 0 ? (
        <EmptyState title={empty ? '題庫還是空的' : '沒有符合條件的考卷'}>
          {empty ? '匯入考卷、校對後按「存入題庫」，考卷就會出現在這裡。' : '換個關鍵字或篩選條件試試。'}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {exams.map((exam) => (
            <li key={exam.id}>
              <ExamCard exam={exam} />
            </li>
          ))}
        </ul>
      )}

      {matches && matches.total > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-muted">
            符合「{search}」的題目 · {matches.total} 題{matches.total > matches.items.length ? `（顯示前 ${matches.items.length} 題）` : ''}
          </h2>
          <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {matches.items.map((q) => (
              <li key={q.id}>
                <Link href={`/bank/${q.id}`} className="block h-full rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent/50">
                  <p className="mb-2 truncate text-xs text-muted">{q.examTitle ?? '未命名考卷'}</p>
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
