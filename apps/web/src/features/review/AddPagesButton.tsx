'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { shrinkPhoto } from '@/features/imports/shrink'
import { useT } from '@/shared/i18n/client'
import { IconFileAdd, IconLoader } from '@/shared/icons'
import { pill } from '@/shared/PageControls'
import { Toast } from '@/shared/Toast'
import { addPages } from './pageActions'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.gif,.bmp'

/**
 * 加入頁面, in the page viewer's controls: more PDF files or photos go after the last page and only
 * they are read; the page then shows the reading, and the questions already edited stay as they are.
 */
export function AddPagesButton({ importId }: { importId: string }) {
  const t = useT()
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const send = (list: FileList | null) => {
    const files = Array.from(list ?? [])
    if (!files.length) return
    setError(null)
    start(async () => {
      const form = new FormData()
      for (const f of await Promise.all(files.map(shrinkPhoto))) form.append('files', f)
      const result = await addPages(importId, form).catch(() => ({ error: t('沒有存好，再試一次。') }))
      if (input.current) input.current.value = ''
      if (result?.error) {
        setError(result.error)
        setTimeout(() => setError(null), 6000)
      } else router.refresh()
    })
  }

  return (
    <>
      <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => send(e.target.files)} />
      <button type="button" onClick={() => input.current?.click()} disabled={pending} className={pill} aria-label={t('加入頁面（PDF 或照片）')} title={t('加入頁面（PDF 或照片）')}>
        {pending ? <IconLoader size={14} className="m-spin" /> : <IconFileAdd size={14} />}
      </button>
      {/* on the page itself, since the controls' blur would hold a fixed note inside them */}
      {error !== null && createPortal(<Toast show>{error}</Toast>, document.body)}
    </>
  )
}
