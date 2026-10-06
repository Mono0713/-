import type { IntegrityEvent } from '@exam/quiz'
import type { T } from '@/shared/i18n/format'
import { msg } from '@/shared/i18n/format'
import { Card } from '@/shared/ui'
import { LocalTime } from './LocalTime'

const KIND: Record<IntegrityEvent['kind'], string> = {
  hidden: msg('離開考試頁面（切到別的分頁、程式或主畫面）'),
  blur: msg('視窗失去焦點（點了別的視窗、截圖或 Lens 等覆蓋畫面）'),
  fullscreen: msg('離開全螢幕'),
  screenshot: msg('按了截圖鍵'),
  copy: msg('複製或剪下文字'),
  paste: msg('貼上文字'),
}

const seconds = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)}s` : `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`)

/** What the exam page noticed while the student wrote, in order, for the teacher to judge. */
export function IntegrityLog({ events, t }: { events: IntegrityEvent[]; t: T }) {
  return (
    <Card className="mb-4 p-5">
      <h2 className="mb-1 text-sm font-semibold">{t('考試紀錄')}</h2>
      <p className="mb-3 text-xs text-muted">{t('網頁看得到的動作才會記錄；手機截圖、用另一台裝置查資料無法偵測。')}</p>
      {events.length === 0 ? (
        <p className="text-sm text-muted">{t('作答期間沒有離開畫面。')}</p>
      ) : (
        <ol className="space-y-1 text-sm">
          {events.map((e, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-32 shrink-0 text-muted">
                <LocalTime at={e.at} />
              </span>
              <span className="flex-1">{t(KIND[e.kind])}</span>
              {e.ms !== undefined && <span className="num shrink-0 text-muted">{seconds(e.ms)}</span>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
