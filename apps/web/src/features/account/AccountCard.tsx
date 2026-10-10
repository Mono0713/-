import { getT } from '@/shared/i18n/server'
import { IconDownload } from '@/shared/icons'
import { Card } from '@/shared/ui'
import { DeleteAccount } from './DeleteAccount'

/** 帳號與資料: a copy of everything, and deleting the account. Shown only with sign-in. */
export async function AccountCard() {
  const t = await getT()
  return (
    <section id="account" className="mt-6 scroll-mt-6">
      <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted">{t('帳號與資料')}</h2>
      <Card className="divide-y divide-line/70">
        <Row title={t('下載我的資料')} note={t('題庫、作答紀錄、班級和設定，存成一個 JSON 檔。API 金鑰不會包含在內。')}>
          <a href="/api/account/export" download className="m-press flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-ink/[0.06] hover:text-ink">
            <IconDownload size={16} />
            {t('下載')}
          </a>
        </Row>
        <Row title={t('刪除帳號')} note={t('刪除所有考卷、題目、作答紀錄、檔案和金鑰，你建立的班級也會一起刪除。按下後有 5 秒可以復原，之後就無法救回。')}>
          <DeleteAccount />
        </Row>
      </Card>
    </section>
  )
}

function Row({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{note}</p>
      </div>
      {children}
    </div>
  )
}
