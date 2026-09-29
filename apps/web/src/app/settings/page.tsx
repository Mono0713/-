import { LOCALES, publicView } from '@exam/settings'
import { SettingsForm } from '@/features/settings/SettingsForm'
import { availableProviders, currentOwner, keySource, localeOf, services } from '@/server/context'
import { PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: '設定' }

export default function SettingsPage() {
  const owner = currentOwner()
  // Only the public view reaches the browser: API keys stay on the server.
  const settings = publicView(services().settings.get(owner))
  const providers = availableProviders(owner)
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="設定" subtitle="語言、辨識方式、模型和 API 金鑰。" />
      <SettingsForm
        locales={[...LOCALES]}
        locale={localeOf(owner)}
        defaultProvider={settings.defaultProvider}
        providers={providers}
        keys={Object.fromEntries(providers.map((p) => [p.id, { source: keySource(owner, p.id), hint: settings.apiKeys[p.id]?.hint ?? null }]))}
      />
    </div>
  )
}
