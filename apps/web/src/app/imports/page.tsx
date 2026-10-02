import { ImportList } from '@/features/imports/ImportList'
import { UploadForm } from '@/features/imports/UploadForm'
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
      </section>
      <section>
        <h2 className="mb-3 mt-1 text-sm font-semibold text-muted lg:mt-[4.25rem]">最近匯入</h2>
        <ImportList imports={imports} />
      </section>
    </div>
  )
}
