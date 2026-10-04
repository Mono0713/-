import { getT } from '@/shared/i18n/server'
import { Card } from '@/shared/ui'

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 100 * 1024 * 1024 ? 1 : 0)} MB`

/** How much the account keeps: uploads, page images and figures, each distinct file counted once per place it is used. */
export async function StorageCard({ used, quota }: { used: number; quota: number | null }) {
  const t = await getT()
  const share = quota ? Math.min(1, used / quota) : null
  return (
    <Card className="mt-6 space-y-3 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{t('儲存空間')}</h2>
        <p className="text-sm text-muted">
          <span className="num text-ink">{mb(used)}</span>
          {quota ? ` / ${mb(quota)}` : t('（本機沒有上限）')}
        </p>
      </div>
      {share !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-ink/[0.07]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-label={t('已用空間')}>
          <div className={`h-full rounded-full ${share > 0.9 ? 'bg-bad' : 'bg-accent'}`} style={{ width: `${Math.max(share * 100, 1)}%` }} />
        </div>
      )}
      <p className="text-xs text-muted">{t('上傳的原檔存 30 天（勾「永久保留原檔」的除外），頁面圖片和題目附圖會一直保留。同一張圖不管用在幾個地方，都只存一份。')}</p>
    </Card>
  )
}
