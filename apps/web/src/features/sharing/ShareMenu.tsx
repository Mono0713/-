'use client'

import type { AnswerRelease } from '@exam/sharing'
import { useState, useTransition } from 'react'
import { Menu } from '@/shared/chrome/Menu'
import { useT } from '@/shared/i18n/client'
import { msg } from '@/shared/i18n/format'
import { IconCheck, IconCopy, IconShare, IconUnlink } from '@/shared/icons'
import { Segmented } from '@/shared/Segmented'
import { Button } from '@/shared/ui'
import { closeShare, shareExam } from './actions'

const RELEASES = [
  ['after_submit', msg('看得到')],
  ['never', msg('看不到')],
] as const satisfies readonly (readonly [AnswerRelease, string])[]

/**
 * The exam's 分享 button: a link anyone signed in can open to practise, take the exam or
 * copy it to their own bank, whether they see the answers and may copy it, and closing the link.
 * Changing a choice on an open link applies to that same link at once.
 */
export function ShareMenu({ examId, initial }: { examId: string; initial: { token: string; answers: AnswerRelease; allowCopy: boolean } | null }) {
  const t = useT()
  const [share, setShare] = useState(initial)
  const [answers, setAnswers] = useState<AnswerRelease>(initial?.answers ?? 'after_submit')
  const [allowCopy, setAllowCopy] = useState(initial?.allowCopy ?? true)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()
  // Only read once the menu is open, in the browser.
  const link = share && typeof window !== 'undefined' ? `${location.origin}/s/${share.token}` : ''

  const open = (next: { answers: AnswerRelease; allowCopy: boolean }) =>
    start(async () => {
      const { token } = await shareExam(examId, next.answers, next.allowCopy)
      setShare({ token, ...next })
    })
  const copy = async () => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Menu
      label={t('分享')}
      align="right"
      className="m-press m-push-quiet inline-flex items-center gap-1.5 rounded-lg bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-accent-soft/50"
      button={
        <>
          <IconShare size={16} />
          {share ? t('已分享') : t('分享')}
        </>
      }
    >
      <div className="space-y-3 p-2">
        <div className="space-y-1.5">
          <p className="text-xs text-muted">{t('答案和詳解')}</p>
          <Segmented
            value={answers}
            options={RELEASES.map(([v, l]) => [v, t(l)] as const)}
            onChange={(next) => {
              setAnswers(next)
              if (share) open({ answers: next, allowCopy })
            }}
          />
          <p className="text-xs text-muted">
            {answers === 'never'
              ? allowCopy
                ? t('只看得到對錯，看不到答案和詳解，加到題庫的副本也不含答案。')
                : t('只看得到對錯，看不到答案和詳解。')
              : t('練習時每做完一題，就能看那一題的答案和詳解；考試則是交卷後一起看。')}
          </p>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="m-check mt-0.5"
            checked={allowCopy}
            onChange={(e) => {
              setAllowCopy(e.target.checked)
              if (share) open({ answers, allowCopy: e.target.checked })
            }}
          />
          <span>
            {t('可以加到自己的題庫')}
            <span className="block text-xs text-muted">{t('拿到連結的人能存一份副本，自己修改、反覆練習。')}</span>
          </span>
        </label>
        {share ? (
          <>
            <div className="flex items-center gap-1.5 rounded-lg border border-line bg-paper py-1 pl-2.5 pr-1">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{link}</span>
              <button type="button" onClick={copy} className="m-press grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-ink/[0.06] hover:text-ink" aria-label={t('複製連結')} title={t('複製連結')}>
                {copied ? <IconCheck size={15} className="text-good" /> : <IconCopy size={15} />}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {'share' in navigator && (
                <Button className="flex-1" onClick={() => void navigator.share({ url: link }).catch(() => {})}>
                  {t('傳給別人')}
                </Button>
              )}
              <Button
                variant="ghost"
                className="flex-1 text-bad"
                icon={<IconUnlink size={15} />}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await closeShare(examId)
                    setShare(null)
                  })
                }
              >
                {t('關閉連結')}
              </Button>
            </div>
            <p className="text-xs text-muted">
              {t('上面的設定改了就直接套用到這個連結，之後開始做的人照新的設定。關閉後連結立刻失效，再分享會是新的連結。')}
            </p>
          </>
        ) : (
          <Button variant="primary" className="w-full" loading={pending} disabled={pending} onClick={() => open({ answers, allowCopy })}>
            {t('建立分享連結')}
          </Button>
        )}
      </div>
    </Menu>
  )
}
