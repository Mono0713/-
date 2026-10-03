'use client'

import { useState, useTransition } from 'react'
import { IconClass, IconPlus } from '@/shared/icons'
import { Button, Card, inputClass } from '@/shared/ui'
import { createClass, joinClass } from './actions'

/** Join a class with the code from the teacher, or start one of your own. */
export function ClassHome() {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<{ join?: string; create?: string }>({})
  const [busy, setBusy] = useState<'join' | 'create' | null>(null)
  const [pending, start] = useTransition()
  const run = (what: 'join' | 'create', action: () => Promise<{ error: string } | undefined>) => {
    setBusy(what)
    setError({})
    start(async () => {
      // On success each action opens the class.
      const result = await action()
      if (result) setError({ [what]: result.error })
      setBusy(null)
    })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <IconClass size={17} className="text-muted" />
          加入班級
        </h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim()) run('join', () => joinClass(code))
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="老師給的加入碼"
            aria-label="加入碼"
            autoComplete="off"
            maxLength={8}
            className={`${inputClass} font-mono tracking-[0.2em] uppercase placeholder:font-sans placeholder:tracking-normal`}
          />
          <Button type="submit" variant="primary" loading={busy === 'join'} disabled={pending || !code.trim()}>
            加入
          </Button>
        </form>
        {error.join && <p className="m-shake text-sm text-bad">{error.join}</p>}
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <IconPlus size={17} className="text-muted" />
          開一個班級
        </h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) run('create', () => createClass(name))
          }}
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：三年二班 生物" aria-label="班級名稱" maxLength={80} className={inputClass} />
          <Button type="submit" loading={busy === 'create'} disabled={pending || !name.trim()}>
            建立
          </Button>
        </form>
        {error.create && <p className="m-shake text-sm text-bad">{error.create}</p>}
      </Card>
    </div>
  )
}
