import { IconLoader } from '@/shared/icons'

/**
 * While an exam opens: the editor's own blank full-screen workspace, not the site-wide sketch
 * of a card grid (which looked nothing like the editor). A small spinner shows only if it is slow.
 */
export default function Loading() {
  return (
    <div aria-busy aria-label="載入中" className="workspace flex h-dvh items-center justify-center">
      <IconLoader size={22} className="m-late m-spin text-muted" />
    </div>
  )
}
