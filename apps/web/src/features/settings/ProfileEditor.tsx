'use client'

import { useRef, useState, useTransition } from 'react'
import { Avatar } from '@/shared/chrome/AccountMenu'
import { useT } from '@/shared/i18n/client'
import { IconCamera } from '@/shared/icons'
import { inputClass } from '@/shared/ui'
import { saveProfile } from './actions'

/** The picture is kept small: it is drawn at most at 36 px, so 128 px covers sharp screens. */
const AVATAR_PX = 128

/** Crops the middle square of a picture and shrinks it to a small WebP data URL. */
async function toAvatar(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = AVATAR_PX
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX)
  bitmap.close()
  return canvas.toDataURL('image/webp', 0.85)
}

/**
 * Name and picture, saved on the spot: the name when the field is left (or Enter), the picture as
 * soon as one is picked. Both can go back to what the Google account says.
 */
export function ProfileEditor({
  name,
  avatar,
  email,
  google,
}: {
  name: string | null
  avatar: string | null
  email: string | null
  google: { name: string | null; avatar: string | null }
}) {
  const t = useT()
  const [, start] = useTransition()
  const [shownAvatar, setShownAvatar] = useState(avatar)
  const [draft, setDraft] = useState(name ?? '')
  const saved = useRef(name ?? '')
  const file = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const saveName = () => {
    const next = draft.trim()
    if (next === saved.current) return
    saved.current = next
    // an emptied field goes back to the Google name
    if (!next) setDraft(google.name ?? '')
    start(() => saveProfile({ name: next && next !== google.name ? next : null }))
  }
  const pick = async (f: File | undefined) => {
    if (!f) return
    setError(null)
    try {
      const url = await toAvatar(f)
      setShownAvatar(url)
      start(() => saveProfile({ avatar: url }))
    } catch {
      setError(t('這張圖片讀不出來，換一張試試。'))
    }
  }
  const resetAvatar = () => {
    setShownAvatar(google.avatar)
    start(() => saveProfile({ avatar: null }))
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <button type="button" onClick={() => file.current?.click()} className="m-press group relative shrink-0 rounded-full" aria-label={t('更換頭像')}>
        <Avatar person={{ name: draft || google.name, email, avatar: shownAvatar }} size="xl" />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <IconCamera size={18} />
        </span>
      </button>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
      <div className="min-w-0 flex-1 space-y-1">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          maxLength={40}
          autoComplete="off"
          placeholder={google.name ?? t('你的名字')}
          aria-label={t('名字')}
          className={`${inputClass} max-w-xs font-medium`}
        />
        {email && <p className="truncate text-sm text-muted">{email}</p>}
        {error ? (
          <p className="text-xs text-bad">{error}</p>
        ) : (
          shownAvatar !== google.avatar && (
            <button type="button" onClick={resetAvatar} className="text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
              {t('改回 Google 頭像')}
            </button>
          )
        )}
      </div>
    </div>
  )
}
