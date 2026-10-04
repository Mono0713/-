'use client'

import { useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { Button } from '@/shared/ui'
import { joinClass } from './actions'

export function JoinButton({ code }: { code: string }) {
  const t = useT()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        className="w-full"
        loading={pending}
        disabled={pending}
        onClick={() =>
          start(async () => {
            // On success it opens the class.
            setError((await joinClass(code))?.error ?? null)
          })
        }
      >
        {t('加入班級')}
      </Button>
      {error && <p className="m-shake text-sm text-bad">{error}</p>}
    </div>
  )
}
