import { GenerateForm } from '@/features/generate/GenerateForm'
import { routeFor } from '@/server/ai'
import { currentOwner } from '@/server/context'
import { getT } from '@/shared/i18n/server'
import { PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function GeneratePage() {
  const t = await getT()
  // material is usually a PDF or photos, so name the model that would read them
  const route = await routeFor(await currentOwner(), 'generating', true)
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('AI 出題')} subtitle={t('放上講義或筆記，選好題型和題數，AI 會出成一份考卷，排好 A4 可以直接印。')} />
      <GenerateForm model={route?.primary.model ?? null} />
    </div>
  )
}
