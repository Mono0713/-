import { notFound } from 'next/navigation'
import { AutoRefresh } from '@/features/imports/AutoRefresh'
import { DeleteImportButton } from '@/features/imports/DeleteImportButton'
import { StatusBadge } from '@/features/imports/ImportList'
import { ManualPanel } from '@/features/imports/ManualPanel'
import { RerunForm } from '@/features/imports/RerunForm'
import { ReviewEditor } from '@/features/review/ReviewEditor'
import { availableProviders, services } from '@/server/context'
import { Card, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { bank, importer } = services()
  const imp = bank.getImport(id)
  if (!imp) notFound()
  const providers = availableProviders()
  const current = { provider: imp.provider, model: imp.model }
  const header = (
    <PageHeader
      title={imp.title ?? imp.fileName}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <StatusBadge status={imp.status} />
          {imp.pageCount} 頁 · {imp.provider}
          {imp.model ? ` / ${imp.model}` : ''}
        </span>
      }
      actions={<DeleteImportButton importId={id} />}
    />
  )

  if (imp.status === 'processing') {
    const { done, total } = imp.progress
    return (
      <div>
        <AutoRefresh />
        {header}
        <Card className="p-6">
          <p className="font-medium">模型正在讀取頁面…</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">
            已完成 {done} / {total} 頁。遇到免費額度限制時會自動等待後重試，可以先離開這個頁面。
          </p>
        </Card>
      </div>
    )
  }

  if (imp.status === 'waiting') {
    return (
      <div>
        {header}
        <ManualPanel importId={id} state={await importer.manualState(id)} />
      </div>
    )
  }

  const draft = bank.getDraft(id)
  if (imp.status === 'failed' || !draft) {
    return (
      <div>
        {header}
        <Card className="space-y-4 p-6">
          <p className="font-medium text-bad">辨識失敗</p>
          {imp.error && <pre className="whitespace-pre-wrap rounded-lg bg-paper p-3 text-xs text-muted">{imp.error}</pre>}
          <p className="text-sm text-muted">可以換一個模型或改用手動模式再試一次。</p>
          <RerunForm importId={id} providers={providers} current={current} />
        </Card>
      </div>
    )
  }

  const results = await importer.pageResults(id)
  const failed = results.filter((r) => !r.page).map((r) => r.pageNumber)
  const pages = Array.from({ length: imp.pageCount }, (_, i) => ({ pageNumber: i + 1, image: importer.pageImage(id, i + 1) }))
  return (
    <ReviewEditor
        key={id}
        importId={id}
        initial={draft}
        pages={pages}
        savedExam={bank.examForImport(id)}
        heading={{
          title: imp.title ?? imp.fileName,
          status: <StatusBadge key="status" status={imp.status} />,
          meta: `${imp.pageCount} 頁 · ${imp.provider}${imp.model ? ` / ${imp.model}` : ''}`,
          actions: <DeleteImportButton key="actions" importId={id} compact />,
        }}
        notice={
          failed.length > 0 && (
            <Card key="notice" className="space-y-3 p-4 ring-1 ring-bad/30">
              <p className="text-sm">
                <span className="font-medium text-bad">第 {failed.join('、')} 頁沒有讀到。</span>
                <span className="text-muted">重讀只處理這幾頁，但完成後草稿會重新產生，目前在這頁做的修改會被覆蓋。</span>
              </p>
              <RerunForm importId={id} providers={providers} current={current} pages={failed} label="重讀這幾頁" />
            </Card>
          )
        }
      />
  )
}
