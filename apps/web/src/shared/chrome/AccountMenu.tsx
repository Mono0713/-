'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconKey, IconPrivacy, IconSignOut, IconStorage, IconUser, type Icon } from '@/shared/icons'
import { Menu, menuItem } from './Menu'

export interface AccountPerson {
  name: string | null
  email: string | null
  avatar: string | null
}

/** The signed-in person; a click opens their account: profile, API keys, storage, account data and signing out. */
export function AccountMenu({ person, signOut, tone }: { person: AccountPerson; signOut: () => Promise<void>; tone: 'sidebar' | 'header' }) {
  const t = useT()
  const label = person.name ?? person.email ?? t('帳號')
  const links: { href: string; label: string; icon: Icon }[] = [
    { href: '/settings#profile', label: t('個人資料'), icon: IconUser },
    { href: '/settings#keys', label: t('API 金鑰'), icon: IconKey },
    { href: '/settings#storage', label: t('儲存空間'), icon: IconStorage },
    { href: '/settings#account', label: t('帳號與資料'), icon: IconPrivacy },
  ]
  return (
    <Menu
      label={t('帳號')}
      align={tone === 'header' ? 'right' : 'left'}
      side={tone === 'header' ? 'down' : 'up'}
      // the sidebar clips what overflows it (for folding), so its menu is placed against the window
      floating={tone === 'sidebar'}
      // as wide as the sidebar's rows, so it never reaches past the sidebar
      width="w-[13.5rem]"
      className={
        tone === 'header'
          ? 'm-press grid place-items-center rounded-full p-0.5'
          : 'm-press flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left hover:bg-white/[0.06]'
      }
      button={
        tone === 'header' ? (
          <Avatar person={person} />
        ) : (
          <>
            <Avatar person={person} />
            <span className="min-w-0 flex-1 transition-opacity duration-200 rail:opacity-0">
              <span className="block truncate text-[13px] text-white/85">{label}</span>
              {person.name && person.email && <span className="block truncate text-[11px] text-white/40">{person.email}</span>}
            </span>
          </>
        )
      }
    >
      {(close) => (
        <div className="text-ink">
          <div className="flex items-center gap-2.5 px-2.5 pb-2.5 pt-2">
            <Avatar person={person} size="lg" />
            <div className="min-w-0">
              <p className="truncate font-medium">{label}</p>
              {person.name && person.email && <p className="truncate text-xs text-muted">{person.email}</p>}
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          {links.map(({ href, label, icon: I }) => (
            <Link key={href} href={href} onClick={close} role="menuitem" className={menuItem}>
              <I size={16} className="text-muted" />
              {label}
            </Link>
          ))}
          <div className="my-1 h-px bg-line" />
          <form action={signOut}>
            <button type="submit" role="menuitem" className={menuItem}>
              <IconSignOut size={16} className="text-muted" />
              {t('登出')}
            </button>
          </form>
        </div>
      )}
    </Menu>
  )
}

export function Avatar({ person, size = 'md' }: { person: AccountPerson; size?: 'md' | 'lg' | 'xl' }): ReactNode {
  const box = size === 'xl' ? 'h-14 w-14 text-lg' : size === 'lg' ? 'h-9 w-9 text-sm' : 'h-7 w-7 text-xs'
  const initial = (person.name ?? person.email ?? '?').trim().charAt(0).toUpperCase()
  return person.avatar ? (
    // Google's profile pictures; next/image would need their host allow-listed for little gain.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={person.avatar} alt="" referrerPolicy="no-referrer" className={`${box} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${box} grid shrink-0 place-items-center rounded-full bg-accent font-semibold text-on-accent`} aria-hidden>
      {initial}
    </span>
  )
}
