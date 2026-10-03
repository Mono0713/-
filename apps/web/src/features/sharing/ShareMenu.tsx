'use client'

import type { AnswerRelease } from '@exam/sharing'
import { useState, useTransition } from 'react'
import { Menu } from '@/shared/chrome/Menu'
import { IconCheck, IconCopy, IconShare, IconUnlink } from '@/shared/icons'
import { Segmented } from '@/shared/Segmented'
import { Button } from '@/shared/ui'
import { closeShare, shareExam } from './actions'

const RELEASES = [
  ['after_submit', '交卷後公開'],
  ['never', '不公開'],
] as const satisfies readonly (readonly [AnswerRelease, string])[]

/**
 * The exam's 分享 button: a link anyone signed in can open to practise, take the exam or
 * copy it to their own bank, when they see the answers, and closing the link.
 */
export function ShareMenu({ examId, initial }: { examId: string; initial: { token: string; answers: AnswerRelease } | null }) {
  const [share, setShare] = useState(initial)
  const [answers, setAnswers] = useState<AnswerRelease>(initial?.answers ?? 'after_submit')
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()
  // Only read once the menu is open, in the browser.
  const link = share && typeof window !== 'undefined' ? `${location.origin}/s/${share.token}` : ''

  const open = (next: AnswerRelease) =>
    start(async () => {
      const { token } = await shareExam(examId, next)
      setShare({ token, answers: next })
    })
  const copy = async () => {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Menu
      label="分享"
      align="right"
      className="m-press m-push-quiet inline-flex items-center gap-1.5 rounded-lg bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-accent-soft/50"
      button={
        <>
          <IconShare size={16} />
          {share ? '已分享' : '分享'}
        </>
      }
    >
      <div className="space-y-3 p-2">
        <div className="space-y-1.5">
          <p className="text-xs text-muted">答案</p>
          <Segmented
            value={answers}
            options={RELEASES}
            onChange={(next) => {
              setAnswers(next)
              if (share) open(next)
            }}
          />
          <p className="text-xs text-muted">{answers === 'never' ? '拿到連結的人只看得到對錯，看不到答案和詳解，加到題庫的副本也不含答案。' : '練習時對完一題、考試交卷後，才看得到答案和詳解。'}</p>
        </div>
        {share ? (
          <>
            <div className="flex items-center gap-1.5 rounded-lg border border-line bg-paper py-1 pl-2.5 pr-1">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{link}</span>
              <button type="button" onClick={copy} className="m-press grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-ink/[0.06] hover:text-ink" aria-label="複製連結" title="複製連結">
                {copied ? <IconCheck size={15} className="text-good" /> : <IconCopy size={15} />}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {'share' in navigator && (
                <Button className="flex-1" onClick={() => void navigator.share({ url: link }).catch(() => {})}>
                  傳給別人
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
                關閉連結
              </Button>
            </div>
            <p className="text-xs text-muted">拿到連結並登入的人可以練習、考試，或加到自己的題庫。關閉後連結立刻失效，再分享會是新的連結。</p>
          </>
        ) : (
          <Button variant="primary" className="w-full" loading={pending} disabled={pending} onClick={() => open(answers)}>
            建立分享連結
          </Button>
        )}
      </div>
    </Menu>
  )
}
