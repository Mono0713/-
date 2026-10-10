import { redirect } from 'next/navigation'
import { Landing } from '@/features/landing/Landing'
import { landingMetadata } from '@/features/landing/metadata'
import { authEnabled, currentUser } from '@/server/auth'

export const dynamic = 'force-dynamic'
export const generateMetadata = landingMetadata

/** Signed-out visitors see the product page; everyone else goes straight to the app. */
export default async function Home() {
  if (authEnabled() && !(await currentUser())) return <Landing signedIn={false} />
  redirect('/imports')
}
