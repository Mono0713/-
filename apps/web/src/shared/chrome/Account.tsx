import { signOut } from '@/features/auth/actions'
import { authEnabled, LOCAL_PEOPLE, localPerson, localSwitching } from '@/server/auth'
import { currentProfile } from '@/server/profile'
import { AccountMenu } from './AccountMenu'
import { LocalSwitcher } from './LocalSwitcher'

/** The signed-in person, opening their account menu. Without sign-in nothing, except the testing switcher under `pnpm dev`. */
export async function Account({ tone }: { tone: 'sidebar' | 'header' }) {
  if (!authEnabled()) {
    if (!localSwitching()) return null
    const switcher = <LocalSwitcher current={(await localPerson()).id} people={LOCAL_PEOPLE} tone={tone} />
    return tone === 'header' ? <div className="ml-auto shrink-0">{switcher}</div> : switcher
  }
  const user = await currentProfile()
  if (!user) return null
  const person = { name: user.name, email: user.email, avatar: user.avatar }
  return tone === 'header' ? (
    <div className="ml-auto shrink-0">
      <AccountMenu person={person} signOut={signOut} tone="header" />
    </div>
  ) : (
    <AccountMenu person={person} signOut={signOut} tone="sidebar" />
  )
}
