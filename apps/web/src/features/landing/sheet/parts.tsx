import type { CSSProperties, ReactNode } from 'react'
import type { T } from '@/shared/i18n/format'
import type { Text } from '../samples/types'

/** Prints a sample's text in the reader's language (see `Text`). */
export const sayWith =
  (t: T) =>
  (text: Text): string =>
    typeof text === 'string' ? t(text) : 'raw' in text ? text.raw : t(text.key, text.values)

export const LETTERS = 'ABCDEFGH'

/**
 * Each sheet is drawn twice on top of each other: once with the student's pencil (the layer the
 * scan wipes away) and once clean. Pencil keeps its room on the clean copy, so both line up exactly.
 */
export function Pencil({ on, children, className = '' }: { on: boolean; children: ReactNode; className?: string }) {
  return <span className={`inline-block font-hand text-[1.08em] leading-none text-muted ${on ? '' : 'invisible'} ${className}`}>{children}</span>
}

/** The `(   )` printed before a question for the answer letter or ○ / ✕. */
export function Slot({ on, mark }: { on: boolean; mark: string }) {
  return (
    <span className="inline-flex w-[2.2em] shrink-0 items-baseline justify-between text-muted">
      (<Pencil on={on} className="-rotate-3">{mark}</Pencil>)
    </span>
  )
}

/** A line to write on, with the student's answer on it. */
export function Blank({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-block min-w-[3.2em] border-b border-current/60 px-1 text-center">
      <Pencil on={on} className="-rotate-2">
        {children}
      </Pencil>
    </span>
  )
}

/**
 * A question with the box the editor draws around it, labelled with its number and type. The box
 * is only on the clean copy; it appears once the scan has passed (`--i` staggers the boxes).
 */
export function Boxed({ i, label, clean, children }: { i: number; label: string; clean: boolean; children: ReactNode }) {
  return (
    <div className="relative mt-3.5 rounded-md px-2.5 pb-2 pt-2.5">
      {clean && (
        <span className="m-box-in pointer-events-none absolute inset-0 rounded-md border-2 border-accent/70" style={{ '--i': i } as CSSProperties}>
          <span className="absolute -top-2.5 left-2 rounded bg-accent px-1.5 text-[10.5px] font-semibold leading-[18px] text-on-accent">{label}</span>
        </span>
      )}
      {children}
    </div>
  )
}
