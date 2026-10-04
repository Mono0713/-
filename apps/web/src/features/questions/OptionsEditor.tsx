'use client'

import type { DraftQuestion } from '@exam/core'
import { IconPlus } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { MathTextInput } from '@/shared/math/MathTextInput'
import { RemoveButton, SectionHead } from './editorParts'

export function OptionsEditor({ q, onChange }: { q: DraftQuestion; onChange: (q: DraftQuestion) => void }) {
  const t = useT()
  const setOptions = (options: DraftQuestion['options']) => onChange({ ...q, options })
  const nextLabel = () => {
    const last = q.options.at(-1)?.label
    if (last && /^[A-Y]$/.test(last)) return String.fromCharCode(last.charCodeAt(0) + 1)
    if (last && /^\d+$/.test(last)) return String(Number(last) + 1)
    return 'A'
  }
  return (
    <div>
      <SectionHead title={t('選項')}>
        <button type="button" onClick={() => setOptions([...q.options, { label: nextLabel(), content: '' }])} className="m-press flex h-7 items-center gap-1 rounded-md px-2 text-xs text-accent hover:bg-accent-soft">
          <IconPlus size={13} strokeWidth={2.4} />
          {t('新增')}
        </button>
      </SectionHead>
      <div className="grid gap-1.5">
        {q.options.map((o, i) => (
          <MathTextInput
            key={i}
            value={o.content}
            onChange={(v) => setOptions(q.options.map((p, j) => (j === i ? { ...p, content: v } : p)))}
            multiline={false}
            placeholder={t('選項內容')}
            prefix={
              <input
                autoComplete="off"
                value={o.label}
                onChange={(e) => setOptions(q.options.map((p, j) => (j === i ? { ...p, label: e.target.value } : p)))}
                className="num h-7 w-9 rounded-md bg-ink/[0.045] text-center text-[13px] font-semibold text-muted outline-none focus:bg-accent-soft focus:text-accent"
                aria-label={t('選項代號')}
                title={t('選項代號')}
              />
            }
            actions={<RemoveButton label={t('刪除選項 {label}', { label: o.label })} onClick={() => setOptions(q.options.filter((_, j) => j !== i))} />}
          />
        ))}
      </div>
    </div>
  )
}
