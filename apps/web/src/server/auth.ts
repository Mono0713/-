import './env'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'

/**
 * Sign-in with Supabase Auth (Google). It is on when the Supabase URL and anon key are set;
 * without them the app is single-user and everything belongs to "local", as before.
 */
export function authEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/** A Supabase client acting for the person of the current request, through their session cookies. */
export async function supabaseServer() {
  const store = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options)
        } catch {
          // Server components cannot set cookies; the proxy refreshes the session instead.
        }
      },
    },
  })
}

export interface SignedInUser {
  id: string
  email: string | null
  name: string | null
  avatar: string | null
}

/** The signed-in person, verified with Supabase, or null. Once per request. */
export const currentUser = cache(async (): Promise<SignedInUser | null> => {
  if (!authEnabled()) return null
  const { data, error } = await (await supabaseServer()).auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub) return null
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>
  const text = (v: unknown) => (typeof v === 'string' && v ? v : null)
  return { id: claims.sub, email: text(claims.email), name: text(meta.full_name) ?? text(meta.name), avatar: text(meta.avatar_url) ?? text(meta.picture) }
})

/**
 * People to switch between without accounts, so one computer can try both sides of a
 * class (the teacher, and students joining it). "local" owns everything made before.
 */
export const LOCAL_PEOPLE = [
  { id: 'local', name: '本機使用者' },
  { id: 'student-a', name: '學生 A' },
  { id: 'student-b', name: '學生 B' },
  { id: 'student-c', name: '學生 C' },
] as const

export const LOCAL_AS_COOKIE = 'exam-local-as'

/** Which local person this browser is acting as; only without accounts. */
export async function localPerson(): Promise<(typeof LOCAL_PEOPLE)[number]> {
  const id = (await cookies()).get(LOCAL_AS_COOKIE)?.value
  return LOCAL_PEOPLE.find((p) => p.id === id) ?? LOCAL_PEOPLE[0]
}

/** Whose data this request works on. Sends a signed-out person to the sign-in page. Without accounts: the local person picked. */
export async function currentOwner(): Promise<string> {
  if (!authEnabled()) return (await localPerson()).id
  const user = await currentUser()
  if (!user) redirect('/login')
  return user.id
}
