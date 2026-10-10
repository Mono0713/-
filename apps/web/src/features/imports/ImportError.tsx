import Link from 'next/link'
import { getT } from '@/shared/i18n/server'
import { explainError, explainWriteError } from './errors'

/** A failed read (or, with `writing`, a failed AI 出題) in plain words, with the provider's own message folded away underneath. */
export async function ImportError({ error, writing = false }: { error: string; writing?: boolean }) {
  const t = await getT()
  const { title, detail, fix } = (writing ? explainWriteError : explainError)(error, t)
  return (
    <div className="space-y-2">
      <p className="font-medium text-bad">{title}</p>
      <p className="text-sm text-muted">
        {detail}
        {fix === 'settings' && (
          <>
            {' '}
            <Link href="/settings" className="text-accent hover:underline">
              {t('打開設定')}
            </Link>
          </>
        )}
      </p>
      <details className="group text-xs text-muted">
        <summary className="cursor-pointer select-none hover:text-ink">{t('看原始錯誤訊息')}</summary>
        <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-paper p-3 font-mono">{error}</pre>
      </details>
    </div>
  )
}
