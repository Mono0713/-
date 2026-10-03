'use client'

import type { AssignmentAnswers } from '@exam/classes'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { IconTrash } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { Segmented } from '@/shared/Segmented'
import { Button, Card, inputBase } from '@/shared/ui'
import { deleteAssignment, startAssignment, updateAssignment } from './actions'

const ANSWERS = [
  ['after_submit', '交卷後'],
  ['after_close', '截止後'],
  ['never', '不公布'],
] as const satisfies readonly (readonly [AssignmentAnswers, string])[]

/** An ISO moment as a `datetime-local` value in the browser's time zone. */
function toLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

/** The teacher's handles on an assignment: when it closes, when answers show, trying it, deleting it. */
export function AssignmentControls({ classId, assignmentId, closesAt, answers }: { classId: string; assignmentId: string; closesAt: string | null; answers: AssignmentAnswers }) {
  const router = useRouter()
  const { remove } = useRemoval()
  const [close, setClose] = useState(toLocal(closesAt))
  const [release, setRelease] = useState(answers)
  const [pending, start] = useTransition()
  const [trying, startTrying] = useTransition()
  const save = (patch: Parameters<typeof updateAssignment>[1]) =>
    start(async () => {
      await updateAssignment(assignmentId, patch)
      router.refresh()
    })
  const closed = closesAt !== null && new Date(closesAt) <= new Date()

  return (
    <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">截止時間</span>
          <input
            type="datetime-local"
            value={close}
            onChange={(e) => setClose(e.target.value)}
            onBlur={() => close !== toLocal(closesAt) && save({ closesAt: close ? new Date(close).toISOString() : null })}
            className={inputBase}
          />
        </label>
        {!closed && (
          <Button disabled={pending} onClick={() => save({ closesAt: new Date().toISOString() })}>
            立刻截止
          </Button>
        )}
        {closed && (
          <Button disabled={pending} onClick={() => save({ closesAt: null })}>
            重新開放
          </Button>
        )}
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted">公布答案</p>
        <Segmented
          value={release}
          options={ANSWERS}
          onChange={(next) => {
            setRelease(next)
            save({ answers: next })
          }}
        />
        <p className="text-xs text-muted">改了馬上生效，已經交卷的學生也照新的設定。</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line/70 pt-3">
        <Button loading={trying} disabled={trying} onClick={() => startTrying(async () => void (await startAssignment(assignmentId)))}>
          自己試做
        </Button>
        <span className="flex-1 text-xs text-muted">試做不算成績，也不會出現在學生名單。</span>
        <Button
          variant="ghost"
          aria-label="刪除作業"
          className="px-2.5 text-muted hover:bg-bad-soft hover:text-bad"
          icon={<IconTrash size={17} />}
          onClick={() => {
            remove({ id: assignmentId, note: '已刪除作業', commit: () => deleteAssignment(assignmentId) })
            router.push(`/classes/${classId}`)
          }}
        />
      </div>
    </Card>
  )
}
