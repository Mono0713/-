import Link from 'next/link'
import { formatUsd } from '@exam/models'
import { LOCALES, publicView } from '@exam/settings'
import { monthStart, spend } from '@exam/usage'
import { SettingsForm } from '@/features/settings/SettingsForm'
import { ProfileCard } from '@/features/settings/ProfileCard'
import { StorageCard } from '@/features/settings/StorageCard'
import { AccountCard } from '@/features/account/AccountCard'
import { accountControls } from '@/server/account'
import { authEnabled, currentOwner, services } from '@/server/context'
import { keySource, providersOf } from '@/server/ai'
import { storageOf } from '@/server/storage'
import { currentProfile } from '@/server/profile'
import { getLocale, getT } from '@/shared/i18n/server'
import { PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const t = await getT()
  return { title: t('設定') }
}

// Estimates learn from this much recent use.
const ESTIMATE_WINDOW_DAYS = 90

export default async function SettingsPage() {
  const t = await getT()
  const owner = await currentOwner()
  const { settings: store, usage } = services()
  // Only the public view reaches the browser: API keys stay on the server.
  const [saved, locale, recent, thisMonth, storage, user] = await Promise.all([
    store.get(owner),
    getLocale(),
    usage.summary(owner, new Date(Date.now() - ESTIMATE_WINDOW_DAYS * 86_400_000)),
    usage.summary(owner, monthStart()),
    storageOf(owner),
    authEnabled() ? currentProfile() : null,
  ])
  const settings = publicView(saved)
  const routing = providersOf(saved)
  const builtin = routing.filter((p) => !p.id.startsWith('c-'))
  const sources = await Promise.all(builtin.map((p) => keySource(owner, p.id)))
  const month = thisMonth.length ? spend(thisMonth, routing) : null
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('設定')} subtitle={t('語言、外觀，和 AI 要用哪家服務、哪個模型。')} />
      {user && <ProfileCard user={user} />}
      <SettingsForm
        locales={[...LOCALES]}
        locale={locale}
        builtin={builtin.map((p, i) => ({ id: p.id, label: p.label, source: sources[i]!, hint: settings.apiKeys[p.id]?.hint ?? null }))}
        custom={saved.customProviders.map((c) => ({
          id: c.id,
          name: c.name,
          baseUrl: c.baseUrl,
          keyHint: settings.apiKeys[c.id] ? (settings.apiKeys[c.id]!.hint ?? '') : null,
          models: c.models,
          known: saved.knownModels[c.id] ?? [],
        }))}
        hosted={authEnabled()}
        keysInDatabase={Boolean(process.env.DATABASE_URL)}
        routing={routing}
        models={{ strength: saved.strength, taskModels: saved.taskModels, pictureModels: saved.pictureModels, translation: saved.translationEngine, grading: saved.aiGrading.enabled }}
        usage={recent}
        month={month && { usd: formatUsd(month.usd), unpriced: month.unpriced }}
      />
      <StorageCard used={storage.used} quota={storage.quota} />
      {user && accountControls() && <AccountCard />}
      <p className="mt-8 mb-2 text-center text-xs text-muted">
        <Link href="/privacy" className="hover:text-ink hover:underline">
          {t('隱私權政策')}
        </Link>
        <span className="mx-2">·</span>
        <Link href="/terms" className="hover:text-ink hover:underline">
          {t('服務條款')}
        </Link>
      </p>
    </div>
  )
}
