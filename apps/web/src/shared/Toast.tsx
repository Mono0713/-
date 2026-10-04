'use client'

import type { ReactNode } from 'react'

/**
 * A small note at the bottom of the screen, on the navy of the floating controls, with an optional
 * action (復原). It slides up a few pixels and fades; the caller decides how long it stays.
 */
export function Toast({ show, children, action, onAction }: { show: boolean; children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <p aria-live="polite" data-show={show || undefined} className="m-toast flex items-center gap-3 rounded-full bg-night py-2 pl-4 pr-2 text-sm text-white/90 shadow-lg">
        {children}
        {action && (
          <button type="button" onClick={onAction} tabIndex={show ? 0 : -1} className="m-press rounded-full px-3 py-1 font-medium text-night-accent hover:bg-white/10">
            {action}
          </button>
        )}
      </p>
    </div>
  )
}
