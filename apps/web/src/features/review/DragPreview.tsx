import type { DraftQuestion } from '@exam/core'
import { QuestionView } from '@/features/questions/QuestionView'

/**
 * The copy of a card that follows the pointer while it is dragged: the whole card as it looks,
 * same size and same buttons, lifted by its shadow only (`.m-lifted`). `offset` skips a section
 * heading or group text above the card; the drag measures from those.
 */
export function DragPreview({ q, inGroup, offset, flagged, actions }: { q: DraftQuestion; inGroup: boolean; offset: number; flagged: boolean; actions: React.ReactNode }) {
  return (
    <div style={{ paddingTop: offset }} className={inGroup ? 'ml-4 sm:ml-7' : ''}>
      <div data-drag-overlay inert className="m-lifted relative cursor-grabbing rounded-2xl bg-surface p-4 sm:p-5">
        {flagged && <span aria-hidden className="absolute bottom-5 left-0 top-5 w-[3px] rounded-r-full bg-hl" />}
        <QuestionView q={q} onConfirm={() => {}} actions={actions} />
      </div>
    </div>
  )
}
