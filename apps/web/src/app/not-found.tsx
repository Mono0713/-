import { getT } from '@/shared/i18n/server'
import { ButtonLink, EmptyState } from '@/shared/ui'

/** Any address that leads nowhere: the app's own page instead of Next's black one. */
export default async function NotFound() {
  const t = await getT()
  return (
    <div className="mx-auto max-w-md py-16">
      <EmptyState title={t('找不到這個頁面')}>
        <p>{t('網址可能打錯了，或這個內容已經刪除。')}</p>
        <div className="mt-5 flex justify-center">
          <ButtonLink href="/" variant="primary">
            {t('回到首頁')}
          </ButtonLink>
        </div>
      </EmptyState>
    </div>
  )
}
