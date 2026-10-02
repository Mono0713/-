import { redirect } from 'next/navigation'
import { signInWithGoogle } from '@/features/auth/actions'
import { authEnabled, currentUser } from '@/server/auth'
import { BRAND, brandTagline } from '@/shared/brand/brand'
import { LogoMark } from '@/shared/brand/LogoMark'

export const dynamic = 'force-dynamic'
export const metadata = { title: '登入' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  if (!authEnabled() || (await currentUser())) redirect('/')
  const { next, error } = await searchParams
  return (
    // .auth-screen hides the app's navigation (see globals.css).
    <div className="auth-screen grid min-h-[calc(100vh-3rem)] place-items-center">
      <div className="m-enter w-full max-w-sm rounded-2xl bg-surface p-8 text-center shadow-sheet">
        <LogoMark size={48} className="mx-auto text-accent" />
        <h1 className="mt-4 font-display text-[28px] font-extrabold lowercase leading-none tracking-[-0.035em]">{BRAND.name}</h1>
        <p className="mt-2 text-sm text-muted">{brandTagline()}</p>
        <form action={signInWithGoogle} className="mt-8">
          <input type="hidden" name="next" value={next ?? '/'} />
          <button
            type="submit"
            className="m-press flex w-full items-center justify-center gap-3 rounded-lg bg-surface px-4 py-2.5 text-sm font-medium shadow-[0_0_0_1px_var(--color-line),0_1px_2px_rgb(22_24_43/0.05)] hover:shadow-[0_0_0_1px_var(--color-muted),0_1px_2px_rgb(22_24_43/0.05)]"
          >
            <GoogleMark />
            使用 Google 帳號登入
          </button>
        </form>
        {error && <p className="mt-4 rounded-lg bg-bad-soft px-3 py-2 text-left text-sm text-bad">登入失敗：{error}</p>}
        <p className="mt-6 text-xs leading-relaxed text-muted">登入後，你的題庫、測驗和 API 金鑰只屬於你的帳號。</p>
      </div>
    </div>
  )
}

/** Google's "G", in its own colors as Google's sign-in guidelines ask. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
