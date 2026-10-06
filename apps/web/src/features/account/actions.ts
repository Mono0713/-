'use server'

import { redirect } from 'next/navigation'
import { supabaseServer } from '@/server/auth'
import { deleteAccount } from '@/server/account'

/** Deletes the signed-in person and everything they stored, signs them out and leaves for the home page. */
export async function deleteMyAccount() {
  if (await deleteAccount()) await (await supabaseServer()).auth.signOut().catch(() => {})
  redirect('/')
}
