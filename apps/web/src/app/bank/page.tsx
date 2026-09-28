import Link from 'next/link'
import { BankFilters } from '@/features/bank/BankFilters'
import { QuestionView } from '@/features/questions/QuestionView'
import { currentOwner, services } from '@/server/context'
import { ButtonLink, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

export default async function BankPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const page = Math.max(1, Number(params.page) || 1)
  const { bank } = services()
  const owner = currentOwner()
  const { items, total } = bank.listQuestions({
    ownerId: owner,
    search: params.q,
    type: params.type || undefined,
    subject: params.subject || undefined,
    importId: params.import || undefined,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  })
  const pages = Math.ceil(total / PAGE_SIZE)
  const fromImport = params.import ? bank.getImport(params.import) : null
  const pageHref = (n: number) => `/bank?${new URLSearchParams({ ...(params as Record<string, string>), page: String(n) })}`

  return (
    <div>
      <PageHeader
        title="題庫"
        subtitle={fromImport ? `來自「${fromImport.title ?? fromImport.fileName}」的 ${total} 題` : `共 ${total} 題`}
        actions={
          fromImport ? (
            <ButtonLink href="/bank">看全部題目</ButtonLink>
          ) : (
            <ButtonLink href="/imports" variant="primary">
              匯入考卷
            </ButtonLink>
          )
        }
      />
      <BankFilters subjects={bank.subjects(owner)} values={{ q: params.q, type: params.type, subject: params.subject, import: params.import }} />

      {items.length === 0 ? (
        <EmptyState title={total === 0 && !params.q ? '題庫還是空的' : '沒有符合條件的題目'}>
          {total === 0 && !params.q ? '匯入考卷、校對後按「存入題庫」，題目就會出現在這裡。' : '換個關鍵字或篩選條件試試。'}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {items.map((q) => (
            <li key={q.id}>
              <Link href={`/bank/${q.id}`} className="block h-full rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent/50">
                <p className="mb-2 truncate text-xs text-muted">{[q.subject, q.examTitle].filter(Boolean).join(' · ')}</p>
                <QuestionView q={q} compact />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 && <ButtonLink href={pageHref(page - 1)}>上一頁</ButtonLink>}
          <span className="text-muted">
            {page} / {pages}
          </span>
          {page < pages && <ButtonLink href={pageHref(page + 1)}>下一頁</ButtonLink>}
        </nav>
      )}
    </div>
  )
}
