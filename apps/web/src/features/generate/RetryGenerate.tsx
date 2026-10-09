'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconRefresh } from '@/shared/icons'
import { Button, ButtonLink } from '@/shared/ui'
import { retryGenerate } from './actions'

/** After a failed AI 出題: write it again from the same material and choices, or start over with other choices. */
export function RetryGenerate({ importId }: { importId: string }) {
  const t = useT()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          loading={pending}
          icon={<IconRefresh size={16} />}
          onClick={() =>
            start(async () => {
              const result = await retryGenerate(importId)
              if (result?.error) setError(result.error)
              else router.refresh()
            })
          }
        >
          {t('再出一次')}
        </Button>
        <ButtonLink href="/imports/generate">{t('換個設定重新出題')}</ButtonLink>
      </div>
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  )
}
