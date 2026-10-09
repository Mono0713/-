/**
 * A hosted server (a production build on a shared database) without the sign-in settings would treat every
 * visitor as the one local person: anyone could see and change the same data and spend the server's keys.
 * Such a server refuses to work instead, unless ALLOW_SINGLE_USER=1 says one person's server is meant.
 * No Next.js imports, so the proxy can use it too.
 */
export function signInMissing(): boolean {
  const signIn = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  return process.env.NODE_ENV === 'production' && Boolean(process.env.DATABASE_URL) && !signIn && process.env.ALLOW_SINGLE_USER !== '1'
}

export const SIGN_IN_MISSING =
  'Sign-in is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see docs/HOSTING.md), or ALLOW_SINGLE_USER=1 for a one-person server.'
