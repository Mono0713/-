import Link from 'next/link'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { IconEmpty, IconLoader } from '@/shared/icons'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary:
    'm-push m-shine bg-brand text-on-accent hover:brightness-110 disabled:opacity-50 disabled:shadow-none',
  secondary: 'm-push-quiet bg-surface text-ink hover:bg-accent-soft/50 disabled:text-muted',
  ghost: 'text-muted hover:text-ink hover:bg-ink/[0.05]',
  danger: 'text-bad hover:bg-bad-soft',
}

const BASE = 'm-press inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium disabled:cursor-not-allowed'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  /** Leading icon, e.g. <IconUpload size={16} /> */
  icon?: ReactNode
  /** Shows a spinner in place of the icon. */
  loading?: boolean
}

export function Button({ variant = 'secondary', className = '', icon, loading = false, children, ...props }: ButtonProps) {
  return (
    <button type="button" className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props}>
      {loading ? <IconLoader size={16} className="m-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

export function ButtonLink({ href, variant = 'secondary', icon, children }: { href: string; variant?: Variant; icon?: ReactNode; children: ReactNode }) {
  return (
    <Link href={href} className={`${BASE} ${VARIANTS[variant]}`}>
      {icon}
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

export function Card({ children, className = '', interactive = false }: { children: ReactNode; className?: string; interactive?: boolean }) {
  return <div className={`rounded-2xl bg-surface shadow-sheet ${interactive ? 'm-lift' : ''} ${className}`}>{children}</div>
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="m-enter mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em] sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function EmptyState({ title, icon, children }: { title: string; icon?: ReactNode; children?: ReactNode }) {
  return (
    <div className="m-enter rounded-2xl border border-dashed border-ink/15 bg-surface/50 px-6 py-12 text-center">
      <div className="m-float mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-surface text-muted shadow-[0_0_0_1px_var(--color-line)]">
        {icon ?? <IconEmpty size={22} strokeWidth={1.8} />}
      </div>
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  )
}

/** Input look without a width, for inputs sized by their container. */
export const inputBase = 'm-ink rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent/45'
export const inputClass = `${inputBase} w-full`
