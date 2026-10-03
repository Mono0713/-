'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { authEnabled, LOCAL_AS_COOKIE, LOCAL_PEOPLE, supabaseServer } from '@/server/auth'

/** Where the person came from, to return there after signing in; only paths inside the app. */
function safeNext(next: unknown): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/'
}

/** Sends the person to Google; Supabase brings them back to /auth/callback. */
export async function signInWithGoogle(formData: FormData) {
  if (!authEnabled()) redirect('/')
  const h = await headers()
  const origin = process.env.SITE_URL?.replace(/\/+$/, '') || `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`
  const next = safeNext(formData.get('next'))
  const { data, error } = await (await supabaseServer()).auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  })
  if (error || !data.url) redirect(`/login?error=${encodeURIComponent(error?.message ?? 'Google sign-in is not available')}`)
  redirect(data.url)
}

export async function signOut() {
  if (authEnabled()) await (await supabaseServer()).auth.signOut()
  redirect('/login')
}

/** Without accounts: acts as another local person (e.g. a student) in this browser. */
export async function switchLocalPerson(id: string) {
  if (authEnabled() || !LOCAL_PEOPLE.some((p) => p.id === id)) return
  ;(await cookies()).set(LOCAL_AS_COOKIE, id, { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
}
