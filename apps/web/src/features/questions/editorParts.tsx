'use client'

import type { ReactNode } from 'react'
import { IconLoader, IconPlus, IconSparkles, IconX } from '@/shared/icons'

// Small pieces the question form's sections share.

/** The quiet filled look of the small fields in the header line. */
export const chip = 'h-9 rounded-lg bg-ink/[0.045] text-sm outline-none transition-shadow hover:bg-ink/[0.07] focus:bg-surface focus:ring-2 focus:ring-accent/40'
export const iconButton = 'm-press grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted hover:bg-ink/[0.06] hover:text-ink'

/** A section title with its controls on the same line. */
export function SectionHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-1.5 flex h-7 items-center gap-2">
      <span className="text-[11px] font-medium tracking-wide text-muted">{title}</span>
      {children && <div className="ml-auto flex items-center gap-1">{children}</div>}
    </div>
  )
}

export function AddChip({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="m-press flex h-7 items-center gap-1 rounded-full border border-dashed border-ink/15 px-2.5 text-xs text-muted hover:border-accent/50 hover:bg-accent-soft hover:text-accent"
    >
      <IconPlus size={13} strokeWidth={2.4} />
      {children}
    </button>
  )
}

export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${iconButton} h-6 w-6 hover:bg-bad-soft hover:text-bad`} aria-label={label} title={label}>
      <IconX size={14} />
    </button>
  )
}

/** What the editor can ask the AI for this one question (review only); `busy` is the job running. */
export interface QuestionAi {
  answer: () => void
  explain: () => void
  busy?: 'answer' | 'explain'
}

/** A small ✦ button that asks the AI for something; spins while it works. */
export function AiButton({ label, title, busy, onClick, chip = false }: { label: string; title: string; busy: boolean; onClick: () => void; chip?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={title}
      className={`m-press flex h-7 items-center gap-1 text-xs text-accent hover:bg-accent-soft disabled:cursor-progress ${
        chip ? 'rounded-full border border-dashed border-accent/40 px-2.5' : 'rounded-md px-2'
      }`}
    >
      {busy ? <IconLoader size={13} className="m-spin" aria-hidden /> : <IconSparkles size={13} strokeWidth={2.2} />}
      {label}
    </button>
  )
}
