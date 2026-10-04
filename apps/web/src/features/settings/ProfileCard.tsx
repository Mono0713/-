import { signOut } from '@/features/auth/actions'
import type { SignedInUser } from '@/server/auth'
import { Avatar } from '@/shared/chrome/AccountMenu'
import { getT } from '@/shared/i18n/server'
import { IconSignOut } from '@/shared/icons'
import { Card } from '@/shared/ui'

/** Who is signed in, from their Google account, with signing out. */
export async function ProfileCard({ user }: { user: SignedInUser }) {
  const t = await getT()
  return (
    <section id="profile" className="mb-6 scroll-mt-6">
      <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted">{t('個人資料')}</h2>
      <Card className="flex items-center gap-4 p-5">
        <Avatar person={user} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{user.name ?? user.email ?? t('帳號')}</p>
          {user.email && <p className="truncate text-sm text-muted">{user.email}</p>}
          <p className="mt-0.5 text-xs text-muted">{t('用 Google 帳號登入，名稱和頭像跟著 Google。')}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="m-press flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-ink/[0.06] hover:text-ink">
            <IconSignOut size={16} />
            {t('登出')}
          </button>
        </form>
      </Card>
    </section>
  )
}
