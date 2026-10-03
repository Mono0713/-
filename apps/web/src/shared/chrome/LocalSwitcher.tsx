'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { switchLocalPerson } from '@/features/auth/actions'
import { IconCheck } from '@/shared/icons'
import { Menu } from './Menu'

/**
 * For testing under `pnpm dev` only (never in a built app): who this browser acts as. Switching to a student lets one computer try
 * a class from both sides (join with the code, hand in, then switch back to mark).
 */
export function LocalSwitcher({ current, people, tone }: { current: string; people: readonly { id: string; name: string }[]; tone: 'sidebar' | 'header' }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const me = people.find((p) => p.id === current) ?? people[0]!
  const initial = me.name.replace(/^學生\s*/, '').charAt(0)

  return (
    <Menu
      label="切換本機身分"
      align={tone === 'header' ? 'right' : 'left'}
      side={tone === 'header' ? 'down' : 'up'}
      className={
        tone === 'header'
          ? 'm-press grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-semibold text-on-accent'
          : 'm-press flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-white/85 hover:bg-white/[0.06]'
      }
      button={
        tone === 'header' ? (
          initial
        ) : (
          <>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-night-accent text-xs font-semibold text-night">{initial}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{me.name}</span>
              <span className="block text-[11px] text-white/40">測試用 · 點這裡切換身分</span>
            </span>
          </>
        )
      }
    >
      {(close) => (
        <div className="p-1 text-sm text-ink">
          <p className="px-2 pb-1 pt-1.5 text-xs text-muted">只在 pnpm dev 出現，正式版不會有</p>
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await switchLocalPerson(p.id)
                  close()
                  router.refresh()
                })
              }
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent-soft"
            >
              <span className="flex-1">{p.name}</span>
              {p.id === me.id && <IconCheck size={15} className="text-accent" />}
            </button>
          ))}
        </div>
      )}
    </Menu>
  )
}
