import { authEnabled } from '@/server/auth'
import { Audience } from './Audience'
import { Closing } from './Closing'
import { Faq } from './Faq'
import { Features } from './Features'
import { Footer } from './Footer'
import { Hero } from './Hero'
import { LandingNav } from './LandingNav'
import { RevealObserver } from './RevealObserver'
import { Steps } from './Steps'

/**
 * The product page signed-out visitors see at `/` (and anyone at `/welcome`).
 * `.landing` hides the app's sidebar and header and lets the page use the full width (globals.css).
 */
export async function Landing({ signedIn }: { signedIn: boolean }) {
  const start = { signedIn, canSignIn: authEnabled() }
  return (
    // clip: the tilted pile of sample papers may reach past a phone's edge, which must not scroll the page sideways
    <div className="landing overflow-x-clip">
      <LandingNav {...start} />
      <Hero {...start} />
      <Steps />
      <Audience />
      <Features />
      <Faq />
      <Closing {...start} />
      <Footer />
      <RevealObserver />
    </div>
  )
}
