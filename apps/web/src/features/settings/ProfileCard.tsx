import { signOut } from '@/features/auth/actions'
import type { Profile } from '@/server/profile'
import { getT } from '@/shared/i18n/server'
import { IconSignOut } from '@/shared/icons'
import { Card } from '@/shared/ui'
import { ProfileEditor } from './ProfileEditor'

/** Who is signed in: the name and picture they can change, and signing out. */
export async function ProfileCard({ user }: { user: Profile }) {
  const t = await getT()
  return (
    <section id="profile" className="mb-6 scroll-mt-6">
      <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted">{t('個人資料')}</h2>
      <Card className="flex flex-wrap items-center gap-4 p-5">
        <ProfileEditor name={user.name} avatar={user.avatar} email={user.email} google={user.google} />
        <form action={signOut} className="ml-auto">
          <button type="submit" className="m-press flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-ink/[0.06] hover:text-ink">
            <IconSignOut size={16} />
            {t('登出')}
          </button>
        </form>
      </Card>
    </section>
  )
}
