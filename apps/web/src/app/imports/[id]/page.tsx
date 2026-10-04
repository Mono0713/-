import { BLANK, ORIGINAL_DAYS } from '@exam/importer'
import { notFound } from 'next/navigation'
import { AutoRefresh } from '@/features/imports/AutoRefresh'
import { DeleteImportButton } from '@/features/imports/DeleteImportButton'
import { ImportError } from '@/features/imports/ImportError'
import { StatusBadge } from '@/features/imports/ImportList'
import { ManualPanel } from '@/features/imports/ManualPanel'
import { OriginalFiles } from '@/features/imports/OriginalFiles'
import { RerunForm } from '@/features/imports/RerunForm'
import { Scan } from '@/features/imports/Scan'
import { ReviewEditor } from '@/features/review/ReviewEditor'
import { services } from '@/server/context'
import { availableProviders } from '@/server/ai'
import { ownedImport } from '@/server/owned'
import type { T } from '@/shared/i18n/format'
import { getT } from '@/shared/i18n/server'
import { PencilProgress } from '@/shared/motion/PencilProgress'
import { Card, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { bank, importer } = services()
  const imp = await ownedImport(id)
  if (!imp) notFound()
  const t = await getT()
  const providers = await availableProviders(imp.ownerId)
  const current = { provider: imp.provider, model: imp.model }
  const header = (
    <PageHeader
      title={imp.title ?? imp.fileName}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <StatusBadge status={imp.status} />
          {t('{n} 頁 · {provider}', { n: imp.pageCount, provider: providers.find((p) => p.id === imp.provider)?.label ?? imp.provider })}
          {imp.model ? ` / ${imp.model}` : ''}
        </span>
      }
      actions={<DeleteImportButton importId={id} />}
    />
  )

  if (imp.status === 'processing') {
    const { done, total } = imp.progress
    // pages are read roughly in order, so show the next one still being read
    const reading = Math.min(done + 1, imp.pageCount)
    return (
      <div>
        <AutoRefresh />
        {header}
        <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          {reading > 0 && <Scan image={importer.pageImage(imp, reading)} pageNumber={reading} />}
          <div className="min-w-0 flex-1 space-y-3">
            {/* after the last page the draft is put together and its figures cut out and stored */}
            <p className="font-medium">{total && done >= total ? t('頁面都讀完了，正在整理題目、存圖片…') : t('模型正在讀取頁面…')}</p>
            <PencilProgress value={total ? done / total : 0} label={t('已完成 {done} / {total} 頁', { done, total })} />
            <p className="text-sm text-muted">{t('遇到免費額度限制時會自動等待後重試，可以先離開這個頁面。')}</p>
          </div>
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

  const draft = await bank.getDraft(id)
  if (imp.status === 'failed' || !draft) {
    return (
      <div>
        {header}
        <Card className="space-y-4 p-6">
          {imp.error ? <ImportError error={imp.error} /> : <p className="font-medium text-bad">{t('辨識失敗')}</p>}
          <RerunForm importId={id} providers={providers} current={current} />
        </Card>
      </div>
    )
  }

  const results = await importer.pageResults(id)
  const failed = results.filter((r) => !r.page).map((r) => r.pageNumber)
  const failedWhy = results.find((r) => !r.page && r.error)?.error
  const pages = Array.from({ length: imp.pageCount }, (_, i) => ({ pageNumber: i + 1, image: importer.pageImage(imp, i + 1) }))
  const [savedExam, originals] = await Promise.all([bank.examForImport(id), importer.originals(id)])
  const original = {
    files: originals.map((f) => f.name),
    keep: imp.keepOriginal,
    expiresAt: savedExam ? new Date(Date.parse(savedExam.createdAt) + ORIGINAL_DAYS * 86_400_000).toISOString() : null,
    deletedAt: imp.originalDeletedAt,
  }
  return (
    <ReviewEditor
        key={id}
        importId={id}
        initial={draft}
        pages={pages}
        savedExam={savedExam}
        strength={(await services().settings.get(imp.ownerId)).strength}
        heading={{
          title: imp.title ?? imp.fileName,
          meta: imp.provider === BLANK ? t('從零建立') : t('{n} 頁 · {provider}', { n: imp.pageCount, provider: readBy(imp, results, t) }),
          menu: imp.provider === BLANK
            ? [<DeleteImportButton key="menu" importId={id} menu />]
            : [<OriginalFiles key="original" importId={id} state={original} />, <DeleteImportButton key="menu" importId={id} menu />],
        }}
        notice={
          failed.length > 0 && (
            <Card key="notice" className="space-y-3 p-4 ring-1 ring-bad/30">
              <p className="text-sm">
                <span className="font-medium text-bad">{t('第 {pages} 頁沒有讀到。', { pages: failed.join('、') })}</span>
                <span className="text-muted">{t('重讀只處理這幾頁，但完成後草稿會重新產生，目前在這頁做的修改會被覆蓋。')}</span>
              </p>
              {failedWhy && <ImportError error={failedWhy} />}
              <RerunForm importId={id} providers={providers} current={current} pages={failed} label={t('重讀這幾頁')} />
            </Card>
          )
        }
      />
  )
}

/** Who read the pages: manual mode, or the models that did, as automatic reading may use several. */
function readBy(imp: { provider: string; model: string | null }, results: { model: string; page: unknown }[], t: T): string {
  if (imp.provider === 'manual') return t('手動模式')
  const models = [...new Set(results.filter((r) => r.page).map((r) => r.model))]
  return models.length ? models.join('、') : `${imp.provider}${imp.model ? ` / ${imp.model}` : ''}`
}
