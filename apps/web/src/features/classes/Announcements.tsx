'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconTrash } from '@/shared/icons'
import { Removable, useRemoval } from '@/shared/removal'
import { Button, Card, inputClass } from '@/shared/ui'
import { LocalTime } from './LocalTime'
import { deleteAnnouncement, postAnnouncement } from './teaching'

export interface AnnouncementRow {
  id: string
  text: string
  author: string
  createdAt: string
}

/** Notes from the teacher on the class page: everyone reads them, the teachers post and take them down. */
export function Announcements({ classId, items, canPost }: { classId: string; items: AnnouncementRow[]; canPost: boolean }) {
  const t = useT()
  const router = useRouter()
  const { remove } = useRemoval()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (!canPost && !items.length) return null

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-semibold">{t('公告')}</h2>
      {canPost && (
        <div className="space-y-2">
          <textarea
            autoComplete="off"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={t('寫給全班的話，例如：下週三小考第 3 章')}
            aria-label={t('公告內容')}
            className={`${inputClass} resize-y`}
          />
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              loading={pending}
              disabled={pending || !text.trim()}
              onClick={() =>
                start(async () => {
                  const result = await postAnnouncement(classId, text)
                  setError(result?.error ?? null)
                  if (!result) {
                    setText('')
                    router.refresh()
                  }
                })
              }
            >
              {t('發布')}
            </Button>
            {error && <p className="m-shake text-sm text-bad">{error}</p>}
          </div>
        </div>
      )}
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((a) => (
            <Removable key={a.id} id={`announcement-${a.id}`}>
              <li className="group rounded-lg bg-paper px-3 py-2 text-sm">
                <p className="whitespace-pre-wrap break-words">{a.text}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <span className="flex-1">
                    {a.author} · <LocalTime at={a.createdAt} />
                  </span>
                  {canPost && (
                    <button
                      type="button"
                      aria-label={t('刪除公告')}
                      onClick={() => remove({ id: `announcement-${a.id}`, note: t('已刪除公告'), commit: () => deleteAnnouncement(classId, a.id) })}
                      className="grid h-6 w-6 place-items-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-bad-soft hover:text-bad focus-visible:opacity-100 max-sm:opacity-100"
                    >
                      <IconTrash size={13} />
                    </button>
                  )}
                </p>
              </li>
            </Removable>
          ))}
        </ul>
      )}
    </Card>
  )
}
