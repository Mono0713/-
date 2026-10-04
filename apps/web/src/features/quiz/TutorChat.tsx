'use client'

import type { TutorTurn } from '@exam/quiz'
import { useEffect, useRef, useState, useTransition } from 'react'
import { IconLoader, IconSend, IconSparkles } from '@/shared/icons'
import { Markdown } from '@/shared/Markdown'
import { Button, inputBase } from '@/shared/ui'
import { askTutor } from './actions'

// Sent for the button press; the conversation shows the reply as the question's worked solution.
const FIRST = '請寫這題的詳解'
// what the button sent before it asked for a worked solution
const OPENERS = [FIRST, '請講解這題']
const FOLLOW_UPS = ['講簡單一點', '出一題類似的給我練習']

/** 問 AI under a revealed question: a worked solution first, then a chat for follow-up questions. */
export function TutorChat({ attemptId, index, turns: initial, onTurns }: { attemptId: string; index: number; turns: TutorTurn[]; onTurns?: (turns: TutorTurn[]) => void }) {
  const [turns, setTurns] = useState(initial)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (pending || turns.length > initial.length) end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [turns.length, pending, initial.length])

  const send = (text: string) => {
    const message = text.trim()
    if (!message || pending) return
    const before = turns
    setTurns([...before, { from: 'student', text: message, at: new Date().toISOString() }])
    setDraft('')
    setError(null)
    start(async () => {
      const result = await askTutor(attemptId, index, message).catch(() => ({ error: 'AI 暫時沒有回應，請再試一次。' }))
      if ('error' in result) {
        setTurns(before)
        setDraft(message)
        setError(result.error)
        return
      }
      setTurns(result.turns)
      onTurns?.(result.turns)
    })
  }

  if (!turns.length && !error)
    return (
      <Button className="px-3 py-1.5" icon={<IconSparkles size={15} />} onClick={() => send(FIRST)}>
        問 AI
      </Button>
    )

  const last = turns.at(-1)
  // The first reply answers the button press: it is the worked solution, shown as such, and the
  // request itself stays out of the chat. What follows reads like a chat, one bubble per message.
  const opened = turns[0]?.from === 'student' && OPENERS.includes(turns[0].text)
  const solution = opened && turns[1]?.from === 'tutor' ? turns[1] : null
  const chat = turns.slice(solution ? 2 : opened ? 1 : 0)
  return (
    <div className="space-y-3 border-t border-line pt-3">
      <p className="flex items-center gap-1.5 font-medium">
        <IconSparkles size={15} className="text-accent" />
        AI 詳解
      </p>
      {solution && <Markdown className="m-enter">{solution.text}</Markdown>}
      {chat.length > 0 && (
        <div className="space-y-2 border-t border-line/70 pt-3">
          {chat.map((t, i) =>
            t.from === 'student' ? (
              <p key={i} className="m-enter ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent-soft px-3 py-2">
                {t.text}
              </p>
            ) : (
              <div key={i} className="m-enter w-fit max-w-[85%] rounded-2xl rounded-bl-md bg-ink/[0.05] px-3 py-2">
                <Markdown>{t.text}</Markdown>
              </div>
            ),
          )}
        </div>
      )}
      {pending && (
        <p className={`flex items-center gap-2 text-muted ${solution ? 'w-fit rounded-2xl rounded-bl-md bg-ink/[0.05] px-3 py-2' : ''}`}>
          <IconLoader size={15} className="m-spin" aria-hidden />
          {solution ? '思考中…' : '正在寫詳解…'}
        </p>
      )}
      {error && <p className="m-shake rounded-lg bg-bad-soft px-3 py-2 text-bad">{error}</p>}
      {!pending && last?.from === 'tutor' && (
        <div className="flex flex-wrap gap-2">
          {FOLLOW_UPS.map((f) => (
            <button key={f} type="button" onClick={() => send(f)} className="m-press rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted hover:border-accent/50 hover:text-ink">
              {f}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          send(draft)
        }}
      >
        <textarea
          autoComplete="off"
          value={draft}
          rows={1}
          maxLength={1000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter starts a new line; Enter while choosing characters in an input method does neither.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send(draft)
            }
          }}
          placeholder={turns.length ? '還有不懂的地方？例如：為什麼這一步要這樣做？' : '想問這題的什麼？'}
          className={`${inputBase} field-sizing-content max-h-40 min-w-0 flex-1 resize-none`}
        />
        <Button type="submit" variant="primary" className="h-9 w-9 shrink-0 px-0" disabled={!draft.trim() || pending} aria-label="送出">
          <IconSend size={16} />
        </Button>
      </form>
      <div ref={end} />
    </div>
  )
}
