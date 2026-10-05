import { authEnabled } from '@/server/auth'
import { Closing } from './Closing'
import { Features } from './Features'
import { Hero } from './Hero'
import { LandingNav } from './LandingNav'
import { Loop } from './Loop'
import { RevealObserver } from './RevealObserver'

/**
 * The product page signed-out visitors see at `/` (and anyone at `/welcome`).
 * `.landing` hides the app's sidebar and header and lets the page use the full width (globals.css).
 */
export async function Landing({ signedIn }: { signedIn: boolean }) {
  const start = { signedIn, canSignIn: authEnabled() }
  return (
    <div className="landing">
      <LandingNav {...start} />
      <Hero {...start} />
      <Loop />
      <Features />
      <Closing {...start} />
      <RevealObserver />
    </div>
  )
}
