import { BLANK, ORIGINAL_DAYS, WRITTEN, type AfterReading } from '@exam/importer'
import { notFound } from 'next/navigation'
import { AutoRefresh } from '@/features/imports/AutoRefresh'
import { DeleteImportButton } from '@/features/imports/DeleteImportButton'
import { RetryGenerate } from '@/features/generate/RetryGenerate'
import { ImportError } from '@/features/imports/ImportError'
import { StatusBadge } from '@/features/imports/ImportList'
import { ManualPanel } from '@/features/imports/ManualPanel'
import { OriginalFiles } from '@/features/imports/OriginalFiles'
import { RerunForm } from '@/features/imports/RerunForm'
import { Scan } from '@/features/imports/Scan'
import { ReviewEditor } from '@/features/review/ReviewEditor'
import { services } from '@/server/context'
import { availableProviders, modelsByStrength } from '@/server/ai'
import { ownedImport } from '@/server/owned'
import type { T } from '@/shared/i18n/format'
import { getT } from '@/shared/i18n/server'
import { IconLoader } from '@/shared/icons'
import { PencilProgress } from '@/shared/motion/PencilProgress'
import { Card, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { bank, importer } = services()
  let imp = await ownedImport(id)
  if (!imp) notFound()
  // A reading whose run is gone (it died, or the server restarted) is picked up again.
  if ((imp.status === 'processing' && !importer.isRunning(id)) || imp.status === 'failed') {
    await importer.resume(id)
    imp = (await ownedImport(id)) ?? imp
  }
  const t = await getT()
  const providers = await availableProviders(imp.ownerId)
  const current = { provider: imp.provider, model: imp.model }
  const header = (
    <PageHeader
      title={imp.title ?? imp.fileName}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <StatusBadge status={imp.status} provider={imp.provider} />
          {imp.provider === WRITTEN
            ? t('AI 出題 · {model}', { model: imp.model ?? '' })
            : t('{n} 頁 · {provider}', { n: imp.pageCount, provider: providers.find((p) => p.id === imp.provider)?.label ?? imp.provider })}
          {imp.model && imp.provider !== WRITTEN ? ` / ${imp.model}` : ''}
        </span>
      }
      actions={<DeleteImportButton importId={id} />}
    />
  )

  if (imp.status === 'processing' && imp.provider === WRITTEN) {
    const firstPage = await importer.written.firstPage(imp)
    return (
      <div>
        <AutoRefresh />
        {header}
        <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          {firstPage && <Scan image={firstPage} pageNumber={1} />}
          <div className="min-w-0 flex-1 space-y-1.5">
            <p className="flex items-center gap-2 font-medium">
              {!firstPage && <IconLoader size={16} className="m-spin text-accent" aria-hidden />}
              {t('AI 正在讀講義、出題…')}
            </p>
            <p className="text-sm text-muted">{t('出好的考卷會直接打開，可以先離開這個頁面。')}</p>
          </div>
        </Card>
      </div>
    )
  }

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
            <p className="font-medium">{runStep(importer.step(id), Boolean(total && done >= total), t)}</p>
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
  // a reading that failed after the exam was first put together (more pages added, read again) leaves the draft editable
  if (!draft) {
    return (
      <div>
        {header}
        <Card className="space-y-4 p-6">
          {imp.error ? <ImportError error={imp.error} writing={imp.provider === WRITTEN} /> : <p className="font-medium text-bad">{t('辨識失敗')}</p>}
          {imp.provider === WRITTEN ? <RetryGenerate importId={id} /> : <RerunForm importId={id} providers={providers} current={current} />}
        </Card>
      </div>
    )
  }

  const results = await importer.pageResults(id)
  // pages never read count too: pages added whose reading could not start
  const failed = Array.from({ length: imp.pageCount }, (_, i) => i + 1).filter((n) => !results.some((r) => r.pageNumber === n && r.page))
  const failedWhy = results.find((r) => !r.page && r.error)?.error ?? (imp.status === 'failed' ? imp.error : null)
  // a page cut to its sheet keeps the photo as taken, to cut again from the page viewer
  const pages = await importer.sourcePages(imp)
  const [savedExam, originals] = await Promise.all([bank.examForImport(id), importer.originals(id)])
  // a scanned exam whose files were deleted keeps its draft, shown on the A4 sheet
  const scanned = imp.provider !== BLANK && imp.provider !== WRITTEN && imp.pageCount > 0
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
        addPages={scanned}
        strength={(await services().settings.get(imp.ownerId)).strength}
        models={await modelsByStrength(imp.ownerId, ['recognition', 'solving', 'explaining'])}
        heading={{
          title: imp.title ?? imp.fileName,
          meta: imp.provider === BLANK ? t('從零建立') : imp.provider === WRITTEN ? t('AI 出題 · {model}', { model: imp.model ?? '' }) : scanned ? t('{n} 頁 · {provider}', { n: imp.pageCount, provider: readBy(imp, results, t) }) : t('原卷已刪除'),
          menu: [
            ...(scanned ? [<OriginalFiles key="original" importId={id} state={original} />] : []),
            // saved to the bank, only the files go and the exam stays editable here; nothing to delete once they are gone
            ...(!savedExam ? [<DeleteImportButton key="menu" importId={id} menu />] : scanned || originals.length > 0 ? [<DeleteImportButton key="menu" importId={id} menu saved />] : []),
          ],
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

/** What the run is doing now: reading pages, or one of the steps after every page was read. */
function runStep(step: AfterReading | null, allRead: boolean, t: T): string {
  if (step?.step === 'rereading') return t('有幾頁請另一個模型再讀一次…')
  if (step?.step === 'figures' && step.total > 0) return t('正在存圖片 {done} / {total}…', { done: step.done, total: step.total })
  if (step?.step === 'saving') return t('快好了，正在存檔…')
  return step || allRead ? t('頁面都讀完了，正在整理題目…') : t('模型正在讀取頁面…')
}
