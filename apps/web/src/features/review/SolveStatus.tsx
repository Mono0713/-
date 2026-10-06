'use client'

import { useEffect } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconLoader } from '@/shared/icons'
import { Toast } from '@/shared/Toast'
import type { Solver } from './useSolver'

/**
 * The one note for AI 作答 / AI 詳解 started from the floating button: how far a whole-exam run
 * has got, then how it ended (再試一次 when some came back empty). A finished run's note goes by itself.
 */
export function SolveStatus({ solver }: { solver: Solver }) {
  const t = useT()
  const { running, result, dismiss, runAll } = solver
  useEffect(() => {
    if (!result) return
    const timer = setTimeout(dismiss, result.failed ? 8000 : 4000)
    return () => clearTimeout(timer)
  }, [result, dismiss])

  const text = running
    ? running.job === 'answer'
      ? t('AI 正在作答…（{done} / {total}）', running)
      : t('AI 正在寫詳解…（{done} / {total}）', running)
    : result?.error
      ? result.error
      : result?.failed
        ? t('其中 {failed} 題 AI 沒做出來。', { failed: result.failed })
        : result
          ? result.job === 'answer' ? t('AI 作答完成，請確認答案。') : t('AI 詳解完成。')
          : ''
  return (
    <Toast
      show={Boolean(running || result)}
      action={result && result.failed && !result.error ? t('再試一次') : undefined}
      onAction={() => result && runAll(result.job)}
    >
      {running && <IconLoader size={15} className="m-spin shrink-0" aria-hidden />}
      <span className="num">{text}</span>
    </Toast>
  )
}
