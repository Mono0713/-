import { formatUsd } from '@exam/models'
import { LOCALES, publicView } from '@exam/settings'
import { monthStart, spend } from '@exam/usage'
import { SettingsForm } from '@/features/settings/SettingsForm'
import { authEnabled, availableProviders, currentOwner, keySource, localeOf, providersOf, services, teacherChoice } from '@/server/context'
import { PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'
export const metadata = { title: '設定' }

// Estimates learn from this much recent use.
const ESTIMATE_WINDOW_DAYS = 90

export default async function SettingsPage() {
  const owner = await currentOwner()
  const { settings: store, usage } = services()
  // Only the public view reaches the browser: API keys stay on the server.
  const [saved, providers, teacher, locale, recent, thisMonth] = await Promise.all([
    store.get(owner),
    availableProviders(owner),
    teacherChoice(owner),
    localeOf(owner),
    usage.summary(owner, new Date(Date.now() - ESTIMATE_WINDOW_DAYS * 86_400_000)),
    usage.summary(owner, monthStart()),
  ])
  const settings = publicView(saved)
  const routing = providersOf(saved)
  const sources = await Promise.all(providers.map((p) => keySource(owner, p.id)))
  const month = thisMonth.length ? spend(thisMonth, routing) : null
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="設定" subtitle="語言、AI 強度、模型和 API 金鑰。" />
      <SettingsForm
        locales={[...LOCALES]}
        locale={locale}
        defaultProvider={settings.defaultProvider}
        providers={providers}
        aiGrading={{ enabled: settings.aiGrading.enabled, active: teacher }}
        keysInDatabase={Boolean(process.env.DATABASE_URL)}
        keys={Object.fromEntries(providers.map((p, i) => [p.id, { source: sources[i]!, hint: settings.apiKeys[p.id]?.hint ?? null }]))}
        routing={routing}
        strength={{ strength: saved.strength, taskStrength: saved.taskStrength, taskModels: saved.taskModels }}
        usage={recent}
        month={month && { usd: formatUsd(month.usd), unpriced: month.unpriced }}
        custom={saved.customProviders.map((c) => ({
          id: c.id,
          name: c.name,
          baseUrl: c.baseUrl,
          keyHint: settings.apiKeys[c.id] ? (settings.apiKeys[c.id]!.hint ?? '') : null,
          models: c.models,
          known: saved.knownModels[c.id] ?? [],
        }))}
        hosted={authEnabled()}
      />
    </div>
  )
}
