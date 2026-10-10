import { cache } from 'react'
import { currentUser, type SignedInUser } from './auth'
import { services } from './context'

export interface Profile extends SignedInUser {
  /** What the Google account itself says, to go back to. */
  google: { name: string | null; avatar: string | null }
}

/** The signed-in person as shown in the app: the name and picture they chose, else their Google account's. */
export const currentProfile = cache(async (): Promise<Profile | null> => {
  const user = await currentUser()
  if (!user) return null
  const { profile } = await services().settings.get(user.id)
  return { ...user, name: profile.name ?? user.name, avatar: profile.avatar ?? user.avatar, google: { name: user.name, avatar: user.avatar } }
})
