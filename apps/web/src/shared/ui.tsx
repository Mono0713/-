import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent/90 disabled:bg-accent/50',
  secondary: 'bg-surface text-ink border border-line hover:bg-paper disabled:text-muted',
  ghost: 'text-muted hover:text-ink hover:bg-paper',
  danger: 'text-bad hover:bg-bad-soft',
}

const BASE = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed'

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />
}

export function ButtonLink({ href, variant = 'secondary', children }: { href: string; variant?: Variant; children: ReactNode }) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]}`}>
      {children}
    </Link>
  )
}

type Tone = 'neutral' | 'accent' | 'good' | 'warn' | 'bad'
const TONES: Record<Tone, string> = {
  neutral: 'bg-paper text-muted border-line',
  accent: 'bg-accent-soft text-accent border-accent/20',
  good: 'bg-good-soft text-good border-good/20',
  warn: 'bg-warn-soft text-warn border-warn/20',
  bad: 'bg-bad-soft text-bad border-bad/20',
}

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}>{children}</span>
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-surface ${className}`}>{children}</div>
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  )
}

/** Input look without a width, for inputs sized by their container. */
export const inputBase = 'rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15'
export const inputClass = `${inputBase} w-full`
