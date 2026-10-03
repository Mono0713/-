import { IconCheck } from '@/shared/icons'
import { Card } from '@/shared/ui'
import { LocalTime } from './LocalTime'

/** A class attempt whose answers are not out yet: only that it was handed in, no score or right and wrong. */
export function HandedIn({ finishedAt, opensAt }: { finishedAt: string; opensAt: string | null }) {
  return (
    <Card className="m-enter flex items-start gap-4 p-6">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-good-soft text-good">
        <IconCheck size={20} strokeWidth={2.5} />
      </span>
      <div className="space-y-1">
        <p className="font-medium">已交卷</p>
        <p className="text-sm text-muted">
          <LocalTime at={finishedAt} /> 交出。老師公布答案後，這裡會顯示成績和每一題的對錯。
        </p>
        {opensAt && (
          <p className="text-sm text-muted">
            預計公布時間：<LocalTime at={opensAt} />
          </p>
        )}
      </div>
    </Card>
  )
}
