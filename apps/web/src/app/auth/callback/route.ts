import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServer } from '@/server/auth'
import { getT } from '@/shared/i18n/server'
import { safeNext } from '@/shared/safeNext'

/** Google sends the person back here with a one-time code, which becomes their session cookie. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  // Behind a proxy the request's own origin can be an internal address.
  const origin = process.env.SITE_URL?.replace(/\/+$/, '') || url.origin
  const code = url.searchParams.get('code')
  const target = safeNext(url.searchParams.get('next'))
  if (code) {
    const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(target, origin))
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, origin))
  }
  const t = await getT()
  const reason = url.searchParams.get('error_description') ?? t('登入沒有完成')
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, origin))
}
