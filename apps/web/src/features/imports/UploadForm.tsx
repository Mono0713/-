'use client'

import { useRef, useState, useTransition } from 'react'
import { Button, inputClass } from '@/shared/ui'
import { createImport } from './actions'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.gif,.bmp'

export function UploadForm({ providers }: { providers: { id: string; label: string; ready: boolean }[] }) {
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const input = useRef<HTMLInputElement>(null)
  const firstReady = providers.find((p) => p.ready && p.id !== 'manual')?.id ?? 'manual'

  const addFiles = (list: FileList | null) => {
    if (!list) return
    setFiles((prev) => [...prev, ...Array.from(list)])
    setError(null)
  }

  const submit = (form: FormData) => {
    form.delete('files')
    for (const f of files) form.append('files', f)
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
        className={`cursor-pointer rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-accent/50'
        }`}
      >
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => addFiles(e.target.files)} />
        <p className="font-medium">拖曳考卷到這裡，或點一下選擇檔案</p>
        <p className="mt-1 text-sm text-muted">PDF、掃描檔或手機照片都可以。多張照片會依選擇順序合成同一份考卷。</p>
      </div>

      {files.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2">
              <span className="truncate">
                <span className="mr-2 text-muted">{i + 1}.</span>
                {f.name}
              </span>
              <span className="flex shrink-0 items-center gap-3 text-muted">
                {(f.size / 1024 / 1024).toFixed(1)} MB
                <button type="button" className="hover:text-bad" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`移除 ${f.name}`}>
                  移除
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">辨識方式</span>
          <select name="provider" defaultValue={firstReady} className={inputClass}>
            {providers.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.ready}>
                {p.label}
                {p.ready ? '' : '（未設定 API 金鑰）'}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">模型（選填）</span>
          <input name="model" placeholder="留空使用預設模型；手動模式可填 App 名稱" className={inputClass} />
        </label>
      </div>

      {error && <p className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">{error}</p>}

      <Button type="submit" variant="primary" disabled={!files.length || pending}>
        {pending ? '上傳並轉換頁面中…' : '開始辨識'}
      </Button>
    </form>
  )
}
