import { LegalPage } from '@/features/legal/LegalPage'
import { getT } from '@/shared/i18n/server'

export async function generateMetadata() {
  const t = await getT()
  return { title: t('隱私權政策') }
}

export default function PrivacyPage() {
  return <LegalPage kind="privacy" />
}
