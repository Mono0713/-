import { ImportList } from '@/features/imports/ImportList'
import { createBlankExam } from '@/features/imports/actions'
import { UploadForm } from '@/features/imports/UploadForm'
import { IconEdit } from '@/shared/icons'
import { availableProviders, currentOwner, services } from '@/server/context'
import { Card, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function ImportsPage() {
  const owner = await currentOwner()
  const [imports, providers, settings] = await Promise.all([services().bank.listImports(owner), availableProviders(owner), services().settings.get(owner)])
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section>
        <PageHeader title="匯入考卷" subtitle="上傳後由模型讀出題目，校對完再存進題庫。" />
        <Card className="p-5">
          <UploadForm providers={providers} defaultProvider={settings.defaultProvider} />
        </Card>
        {/* No file to read: the editor opens empty and the exam is written question by question. */}
        <form action={createBlankExam} className="mt-3">
          <button
            type="submit"
            className="m-press group flex w-full items-center gap-3 rounded-2xl border border-dashed border-ink/15 px-5 py-4 text-left transition-colors hover:border-accent/50 hover:bg-surface"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <IconEdit size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">從零建立考卷</span>
              <span className="block text-xs text-muted">沒有檔案也可以：直接一題一題寫，寫完一樣存進題庫。</span>
            </span>
            <span className="text-sm text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent">→</span>
          </button>
        </form>
      </section>
      <section>
        <h2 className="mb-3 mt-1 text-sm font-semibold text-muted lg:mt-[4.25rem]">最近匯入</h2>
        <ImportList imports={imports} />
      </section>
    </div>
  )
}
