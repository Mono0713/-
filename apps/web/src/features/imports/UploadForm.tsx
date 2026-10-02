'use client'

import Link from 'next/link'
import { useRef, useState, useTransition } from 'react'
import { IconFile, IconSparkles, IconUpload, IconX } from '@/shared/icons'
import type { ProviderOption } from '@/server/context'
import { ProviderFields } from '@/features/settings/ModelPicker'
import { Button } from '@/shared/ui'
import { createImport } from './actions'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.gif,.bmp'

export function UploadForm({ providers, defaultProvider }: { providers: ProviderOption[]; defaultProvider: string }) {
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const input = useRef<HTMLInputElement>(null)
  const start = providers.find((p) => p.id === defaultProvider && p.ready) ?? providers.find((p) => p.ready && p.id !== 'manual') ?? providers.find((p) => p.id === 'manual')!
  const [choice, setChoice] = useState({ provider: start.id, model: start.model })

  const addFiles = (list: FileList | null) => {
    if (!list) return
    setFiles((prev) => [...prev, ...Array.from(list)])
    setError(null)
  }

  const submit = (form: FormData) => {
    form.delete('files')
    for (const f of files) form.append('files', f)
    form.set('provider', choice.provider)
    form.set('model', choice.model)
    startTransition(async () => {
      const result = await createImport(form)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form action={submit} className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        onClick={() => input.current?.click()}
        className={`group cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-300 ${
          dragging ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
        }`}
      >
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => addFiles(e.target.files)} />
        <div
          className={`mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-surface text-accent shadow-[0_8px_20px_-10px_rgb(29_33_38/0.35)] transition-transform duration-500 [transition-timing-function:var(--m-spring)] group-hover:-translate-y-1 ${
            dragging ? '-translate-y-2 scale-110' : ''
          }`}
        >
          <IconUpload size={26} strokeWidth={2} />
        </div>
        <p className="font-medium">拖曳考卷到這裡，或點一下選擇檔案</p>
        <p className="mt-1 text-sm text-muted">PDF、掃描檔或手機照片都可以。多張照片會依選擇順序合成同一份考卷。</p>
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl bg-surface shadow-sheet text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="m-enter flex items-center justify-between gap-3 px-4 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <IconFile size={16} className="shrink-0 text-accent" />
                <span className="text-muted">{i + 1}.</span>
                <span className="truncate">{f.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-3 text-muted">
                {(f.size / 1024 / 1024).toFixed(1)} MB
                <button type="button" className="m-press grid h-7 w-7 place-items-center rounded-md hover:bg-bad-soft hover:text-bad" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`移除 ${f.name}`}>
                  <IconX size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <ProviderFields providers={providers} provider={choice.provider} model={choice.model} onChange={setChoice} />
        <p className="text-xs text-muted sm:col-span-2">
          API 金鑰、預設的辨識方式和模型在
          <Link href="/settings" className="mx-0.5 text-accent hover:underline">
            設定
          </Link>
          裡調整。
        </p>
      </div>

      {error && <p className="m-shake rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

      <Button type="submit" variant="primary" disabled={!files.length || pending} loading={pending} icon={<IconSparkles size={16} />}>
        {pending ? '上傳並轉換頁面中…' : '開始辨識'}
      </Button>
    </form>
  )
}
