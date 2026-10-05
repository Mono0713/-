import { redirect } from 'next/navigation'
import { Landing } from '@/features/landing/Landing'
import { authEnabled, currentUser } from '@/server/auth'

export const dynamic = 'force-dynamic'

/** Signed-out visitors see the product page; everyone else goes straight to the app. */
export default async function Home() {
  if (authEnabled() && !(await currentUser())) return <Landing signedIn={false} />
  redirect('/imports')
}
