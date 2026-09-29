import { Logo } from '@/shared/brand/Logo'
import { NavLinks } from './NavLinks'

/** Top bar on phones and tablets; wide screens use the sidebar instead. */
export function Header() {
  return (
    <header className="app-header sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md xl:hidden">
      <div className="flex h-14 items-center gap-3 px-4 sm:gap-8 sm:px-6">
        <Logo />
        <NavLinks />
      </div>
    </header>
  )
}
