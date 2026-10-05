import Link from 'next/link'
import { signInWithGoogle } from '@/features/auth/actions'
import { IconArrowRight } from '@/shared/icons'
import { getT } from '@/shared/i18n/server'

export interface Start {
  signedIn: boolean
  /** Google sign-in is set up; without it (local use) the app opens straight away. */
  canSignIn: boolean
}

const BIG = 'm-press m-push m-shine bg-brand text-on-accent hover:brightness-110 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold'
const SMALL = 'm-press m-push-quiet bg-surface text-ink hover:bg-accent-soft/50 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium sm:px-3.5'

/** The page's one call to action: Google sign-in for visitors, the app for everyone else. */
export async function StartButton({ signedIn, canSignIn, size = 'big' }: Start & { size?: 'big' | 'small' }) {
  const t = await getT()
  const big = size === 'big'
  const label = signedIn ? t('前往題庫') : big ? t('免費開始使用') : t('登入')
  const content = (
    <>
      {label}
      {big && <IconArrowRight size={17} aria-hidden className="m-nudge-right" />}
    </>
  )
  if (signedIn || !canSignIn)
    return (
      <Link href="/imports" className={big ? BIG : SMALL}>
        {content}
      </Link>
    )
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value="/imports" />
      <button type="submit" className={big ? BIG : SMALL}>
        {content}
      </button>
    </form>
  )
}
