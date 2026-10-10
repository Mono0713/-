import type { Metadata } from 'next'
import { BRAND, brandTagline } from '@/shared/brand/brand'
import { getLocale, getT } from '@/shared/i18n/server'

/** The product page's title and description in the reader's language, also used for link previews. */
export async function landingMetadata(): Promise<Metadata> {
  const t = await getT()
  const title = `${BRAND.name} · ${brandTagline(await getLocale())}`
  const description = t('拍照、掃描或上傳 PDF，AI 會把每一題框出來，認出題型和答案，寫過的筆跡也不會留在題目上。校對一下存進題庫，就能隨時練習、限時考試，讓 AI 幫你批改。')
  return { title: { absolute: title }, description, openGraph: { title, description, siteName: BRAND.name, type: 'website' } }
}
