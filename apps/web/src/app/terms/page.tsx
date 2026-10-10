import { LegalPage } from '@/features/legal/LegalPage'
import { getT } from '@/shared/i18n/server'

export async function generateMetadata() {
  const t = await getT()
  return { title: t('服務條款') }
}

export default function TermsPage() {
  return <LegalPage kind="terms" />
}
