'use client'

import type { ManualState } from '@exam/importer'
import { useState, useTransition } from 'react'
import { fileUrl } from '@/shared/files'
import { useT } from '@/shared/i18n/client'
import { Button, Card, inputClass } from '@/shared/ui'
import { submitManualReply } from './actions'

/** Manual mode: copy a prompt and the page images into a chat app, paste its JSON reply back. */
export function ManualPanel({ importId, state }: { importId: string; state: ManualState }) {
  const t = useT()
  const waiting = state.pages.filter((p) => !p.done)
  const [mode, setMode] = useState<'batch' | 'single'>(state.batch ? 'batch' : 'single')

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="font-semibold">{t('用聊天 App 辨識')}</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>{t('在 Claude、Gemini 或 ChatGPT 開一個新對話。')}</li>
          <li>{t('附上下面的頁面圖片（依頁碼順序），再貼上「複製提示詞」複製的內容送出。')}</li>
          <li>{t('把整段回覆貼回下方的框，按「送出回覆」。')}</li>
        </ol>
        <p className="mt-3 text-sm">
          {t('已完成 {done} / {total} 頁', { done: state.pages.length - waiting.length, total: state.pages.length })}
        </p>
        {state.batch && (
          <div className="mt-3 inline-flex rounded-lg border border-line p-0.5 text-sm">
            {(['batch', 'single'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 ${mode === m ? 'bg-ink text-paper' : 'text-muted hover:text-ink'}`}
              >
                {m === 'batch' ? t('一次送 {n} 頁', { n: state.batch!.pages.length }) : t('一頁一頁送')}
              </button>
            ))}
          </div>
        )}
      </Card>

      {mode === 'batch' && state.batch ? (
        <ReplyCard
          importId={importId}
          target="batch"
          title={t('第 {pages} 頁一起送', { pages: state.batch.pages.join('、') })}
          images={state.batch.pages.map((n) => state.pages.find((p) => p.pageNumber === n)!)}
          prompt={state.batch.prompt}
          error={null}
        />
      ) : (
        waiting.map((p) => <ReplyCard key={p.pageNumber} importId={importId} target={p.pageNumber} title={t('第 {n} 頁', { n: p.pageNumber })} images={[p]} prompt={p.prompt} error={p.error} />)
      )}
    </div>
  )
}

function ReplyCard({
  importId,
  target,
  title,
  images,
  prompt,
  error,
}: {
  importId: string
  target: number | 'batch'
  title: string
  images: ManualState['pages']
  prompt: string | null
  error: string | null
}) {
  const t = useT()
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const copy = async () => {
    if (!prompt) return
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const submit = () =>
    startTransition(async () => {
      const result = await submitManualReply(importId, target, text)
      setMessage(result?.error ?? null)
      if (!result?.error) setText('')
    })

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <Button variant="primary" onClick={copy} disabled={!prompt}>
          {copied ? t('已複製') : t('複製提示詞')}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {images.map((p) => (
          <a key={p.pageNumber} href={fileUrl(p.image)} download={`page-${p.pageNumber}.${p.image.split('.').pop()}`} className="group block w-28 text-center text-xs text-muted" title={t('下載這一頁的圖片')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(p.image)} alt={t('第 {n} 頁', { n: p.pageNumber })} className="h-36 w-28 rounded-md border border-line object-cover object-top group-hover:border-accent" />
            <span className="mt-1 block group-hover:text-accent">{t('下載 {file}', { file: `page-${p.pageNumber}.png` })}</span>
          </a>
        ))}
      </div>
      {(error || message) && <p className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{message ?? t('上次貼上的回覆格式不符：{error}', { error: error ?? '' })}</p>}
      <textarea
        autoComplete="off"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={t('把聊天 App 的整段回覆貼在這裡（有沒有 ```json 框線都可以）')}
        className={`${inputClass} mt-3 font-mono text-xs`}
      />
      <div className="mt-2 flex justify-end">
        <Button variant="primary" onClick={submit} disabled={!text.trim() || pending}>
          {pending ? t('檢查中…') : t('送出回覆')}
        </Button>
      </div>
    </Card>
  )
}
