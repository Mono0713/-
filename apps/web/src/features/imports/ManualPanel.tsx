'use client'

import type { ManualState } from '@exam/importer'
import { useState, useTransition } from 'react'
import { fileUrl } from '@/shared/files'
import { Button, Card, inputClass } from '@/shared/ui'
import { submitManualReply } from './actions'

/** Manual mode: copy a prompt and the page images into a chat app, paste its JSON reply back. */
export function ManualPanel({ importId, state }: { importId: string; state: ManualState }) {
  const waiting = state.pages.filter((p) => !p.done)
  const [mode, setMode] = useState<'batch' | 'single'>(state.batch ? 'batch' : 'single')

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="font-semibold">用聊天 App 辨識</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>在 Claude、Gemini 或 ChatGPT 開一個新對話。</li>
          <li>附上下面的頁面圖片（依頁碼順序），再貼上「複製提示詞」複製的內容送出。</li>
          <li>把整段回覆貼回下方的框，按「送出回覆」。</li>
        </ol>
        <p className="mt-3 text-sm">
          已完成 {state.pages.length - waiting.length} / {state.pages.length} 頁
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
                {m === 'batch' ? `一次送 ${state.batch!.pages.length} 頁` : '一頁一頁送'}
              </button>
            ))}
          </div>
        )}
      </Card>

      {mode === 'batch' && state.batch ? (
        <ReplyCard
          importId={importId}
          target="batch"
          title={`第 ${state.batch.pages.join('、')} 頁一起送`}
          images={state.batch.pages.map((n) => state.pages.find((p) => p.pageNumber === n)!)}
          prompt={state.batch.prompt}
          error={null}
        />
      ) : (
        waiting.map((p) => <ReplyCard key={p.pageNumber} importId={importId} target={p.pageNumber} title={`第 ${p.pageNumber} 頁`} images={[p]} prompt={p.prompt} error={p.error} />)
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
          {copied ? '已複製' : '複製提示詞'}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        {images.map((p) => (
          <a key={p.pageNumber} href={fileUrl(p.image)} download={`page-${p.pageNumber}.png`} className="group block w-28 text-center text-xs text-muted" title="下載這一頁的圖片">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl(p.image)} alt={`第 ${p.pageNumber} 頁`} className="h-36 w-28 rounded-md border border-line object-cover object-top group-hover:border-accent" />
            <span className="mt-1 block group-hover:text-accent">下載 page-{p.pageNumber}.png</span>
          </a>
        ))}
      </div>
      {(error || message) && <p className="mt-3 rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{message ?? `上次貼上的回覆格式不符：${error}`}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="把聊天 App 的整段回覆貼在這裡（有沒有 ```json 框線都可以）"
        className={`${inputClass} mt-3 font-mono text-xs`}
      />
      <div className="mt-2 flex justify-end">
        <Button variant="primary" onClick={submit} disabled={!text.trim() || pending}>
          {pending ? '檢查中…' : '送出回覆'}
        </Button>
      </div>
    </Card>
  )
}
