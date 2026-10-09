'use client'

import { useRef, useState } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconFile, IconUpload, IconX } from '@/shared/icons'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.txt,.md'

/** The study material: drop or pick PDFs, photos or text files; each can be taken out again. */
export function MaterialPicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const t = useT()
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const add = (list: FileList | null) => list && onChange([...files, ...Array.from(list)])
  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          add(e.dataTransfer.files)
        }}
        onClick={() => input.current?.click()}
        className={`group flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed px-5 py-5 transition-colors duration-300 ${dragging ? 'border-accent bg-accent-soft' : 'border-line bg-surface'}`}
      >
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            add(e.target.files)
            e.target.value = ''
          }}
        />
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-surface text-accent shadow-[0_8px_20px_-10px_rgb(29_33_38/0.35)] transition-transform duration-500 [transition-timing-function:var(--m-spring)] group-hover:-translate-y-0.5 ${dragging ? '-translate-y-1 scale-105' : ''}`}>
          <IconUpload size={20} strokeWidth={2} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{t('拖曳講義到這裡，或點一下選擇檔案')}</span>
          <span className="block text-xs text-muted">{t('PDF、照片或文字檔，最多 30 頁。')}</span>
        </span>
      </div>
      {files.length > 0 && (
        <ul className="divide-y divide-line rounded-xl text-sm shadow-[0_0_0_1px_var(--color-line)]">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="m-enter flex items-center justify-between gap-3 px-3 py-1.5">
              <span className="flex min-w-0 items-center gap-2">
                <IconFile size={15} className="shrink-0 text-accent" />
                <span className="truncate">{f.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                <span className="num">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                <button type="button" className="m-press grid h-7 w-7 place-items-center rounded-md hover:bg-bad-soft hover:text-bad" onClick={() => onChange(files.filter((_, j) => j !== i))} aria-label={t('移除 {name}', { name: f.name })}>
                  <IconX size={15} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
