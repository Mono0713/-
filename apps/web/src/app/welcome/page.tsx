import { Landing } from '@/features/landing/Landing'
import { landingMetadata } from '@/features/landing/metadata'
import { authEnabled, currentUser } from '@/server/auth'

export const dynamic = 'force-dynamic'
export const generateMetadata = landingMetadata

/** The product page for anyone, signed in or not (`/` shows it only to signed-out visitors). */
export default async function Welcome() {
  return <Landing signedIn={!authEnabled() || Boolean(await currentUser())} />
}
