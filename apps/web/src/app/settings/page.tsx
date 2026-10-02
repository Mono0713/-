import { LOCALES, publicView } from '@exam/settings'
import { SettingsForm } from '@/features/settings/SettingsForm'
import { availableProviders, currentOwner, keySource, localeOf, services, teacherFor } from '@/server/context'
import { PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: '設定' }

export default async function SettingsPage() {
  const owner = await currentOwner()
  // Only the public view reaches the browser: API keys stay on the server.
  const [saved, providers, teacher, locale] = await Promise.all([services().settings.get(owner), availableProviders(owner), teacherFor(owner), localeOf(owner)])
  const settings = publicView(saved)
  const sources = await Promise.all(providers.map((p) => keySource(owner, p.id)))
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="設定" subtitle="語言、辨識方式、模型和 API 金鑰。" />
      <SettingsForm
        locales={[...LOCALES]}
        locale={locale}
        defaultProvider={settings.defaultProvider}
        providers={providers}
        aiGrading={{ ...settings.aiGrading, active: teacher ? { provider: teacher.provider, model: teacher.model } : null }}
        keysInDatabase={Boolean(process.env.DATABASE_URL)}
        keys={Object.fromEntries(providers.map((p, i) => [p.id, { source: sources[i]!, hint: settings.apiKeys[p.id]?.hint ?? null }]))}
      />
    </div>
  )
}
