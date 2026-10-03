'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { IconCheck, IconCopy, IconRefresh } from '@/shared/icons'
import { Button, Card } from '@/shared/ui'
import { renewJoinCode, setJoinOpen } from './actions'

/** How students get in: the code to read out, a link to send, and a QR code to show on a screen. */
export function JoinPanel({ classId, code, open, link, qr }: { classId: string; code: string; open: boolean; link: string; qr: string }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [pending, start] = useTransition()
  const copy = async () => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  const act = (action: () => Promise<unknown>) =>
    start(async () => {
      await action()
      router.refresh()
    })

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">加入方式</h2>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" className="m-check" checked={open} disabled={pending} onChange={(e) => act(() => setJoinOpen(classId, e.target.checked))} />
          開放加入
        </label>
      </div>
      <div className={open ? '' : 'opacity-50'}>
        <p className="num text-center text-3xl tracking-[0.25em]" aria-label="加入碼">
          {code}
        </p>
        <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-line bg-paper py-1 pl-2.5 pr-1">
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{link}</span>
          <button type="button" onClick={copy} className="m-press grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-ink/[0.06] hover:text-ink" aria-label="複製加入連結">
            {copied ? <IconCheck size={15} className="text-good" /> : <IconCopy size={15} />}
          </button>
        </div>
        {showQr && (
          // always dark on white, so phones read it in dark mode too
          <div className="m-expand mx-auto mt-3 w-44 rounded-xl bg-white p-2" dangerouslySetInnerHTML={{ __html: qr }} />
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => setShowQr(!showQr)}>
          {showQr ? '收起 QR code' : '顯示 QR code'}
        </Button>
        <Button variant="ghost" className="flex-1" icon={<IconRefresh size={15} />} disabled={pending} onClick={() => act(() => renewJoinCode(classId))}>
          換一組
        </Button>
      </div>
      <p className="text-xs text-muted">換一組之後，舊的加入碼和連結就不能用了；已經加入的人不受影響。</p>
    </Card>
  )
}
