import { Logo } from '@/shared/brand/Logo'
import { NavLinks } from './NavLinks'

/** Sticky top bar: logo and main navigation. */
export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-8 sm:px-6">
        <Logo />
        <NavLinks />
      </div>
    </header>
  )
}
