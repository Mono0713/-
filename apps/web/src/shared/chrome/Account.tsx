import { signOut } from '@/features/auth/actions'
import { authEnabled, currentUser, LOCAL_PEOPLE, localPerson, type SignedInUser } from '@/server/auth'
import { IconSignOut } from '@/shared/icons'
import { LocalSwitcher } from './LocalSwitcher'

/** The signed-in person and a sign-out button; without sign-in, which local person this browser acts as. */
export async function Account({ tone }: { tone: 'sidebar' | 'header' }) {
  if (!authEnabled()) {
    const switcher = <LocalSwitcher current={(await localPerson()).id} people={LOCAL_PEOPLE} tone={tone} />
    return tone === 'header' ? <div className="ml-auto shrink-0">{switcher}</div> : <div className="border-t border-white/[0.07] px-3 py-2">{switcher}</div>
  }
  const user = await currentUser()
  if (!user) return null
  const label = user.name ?? user.email ?? '帳號'
  if (tone === 'header') {
    return (
      <form action={signOut} className="ml-auto shrink-0">
        <button type="submit" className="m-press flex items-center gap-2 rounded-full p-0.5 text-muted hover:text-ink" title={`${label} · 登出`} aria-label="登出">
          <Avatar user={user} />
          <IconSignOut size={16} aria-hidden />
        </button>
      </form>
    )
  }
  return (
    <div className="flex items-center gap-2.5 border-t border-white/[0.07] px-5 py-3">
      <Avatar user={user} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-white/85">{label}</p>
        {user.name && user.email && <p className="truncate text-[11px] text-white/40">{user.email}</p>}
      </div>
      <form action={signOut}>
        <button type="submit" className="m-press grid h-8 w-8 place-items-center rounded-md text-white/45 hover:bg-white/[0.06] hover:text-white" title="登出" aria-label="登出">
          <IconSignOut size={16} />
        </button>
      </form>
    </div>
  )
}

function Avatar({ user }: { user: SignedInUser }) {
  const initial = (user.name ?? user.email ?? '?').trim().charAt(0).toUpperCase()
  return user.avatar ? (
    // Google's profile pictures; next/image would need their host allow-listed for little gain.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatar} alt="" referrerPolicy="no-referrer" className="h-7 w-7 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-on-accent" aria-hidden>
      {initial}
    </span>
  )
}
