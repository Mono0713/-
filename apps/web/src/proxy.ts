import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import './server/env'

/** Pages anyone may open without signing in (and `/`, the product page). */
const PUBLIC = ['/welcome', '/login', '/auth/', '/privacy', '/manifest.webmanifest']

/**
 * With sign-in on: keeps the Supabase session cookie fresh on every request (server
 * components cannot write cookies) and sends signed-out visitors to the sign-in page.
 * Pages and actions still check the person themselves; this is only the front door.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.next()

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of list) response.cookies.set(name, value, options)
      },
    },
  })
  const { data } = await supabase.auth.getClaims()
  const path = request.nextUrl.pathname
  if (!data?.claims && path !== '/' && !PUBLIC.some((p) => path === p || path.startsWith(p))) {
    if (path.startsWith('/api/')) return new NextResponse('Sign in first', { status: 401 })
    const login = request.nextUrl.clone()
    login.pathname = '/login'
    login.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`
    return NextResponse.redirect(login)
  }
  return response
}

export const config = {
  // Everything except Next's own files and static assets.
  matcher: ['/((?!_next/static|_next/image|icon.svg|favicon.ico|fonts/|icons/|sw\\.js|offline\\.html|.*\\.(?:png|jpg|jpeg|svg|webp|woff2?)$).*)'],
}
