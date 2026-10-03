'use client'

import type { ClassRole } from '@exam/classes'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { IconTrash } from '@/shared/icons'
import { Removable, useRemoval } from '@/shared/removal'
import { Card } from '@/shared/ui'
import { removeMember, setMemberRole } from './actions'

export interface MemberRow {
  userId: string
  name: string
  role: ClassRole
}

const LABELS: Record<ClassRole, string> = { teacher: '老師', assistant: '助教', student: '學生' }

/**
 * Who is in the class. The teacher can make a student an assistant (who can also give and
 * mark assignments) and take people out; taking out is undone with 復原.
 */
export function Members({ classId, members, me, isOwner }: { classId: string; members: MemberRow[]; me: string; isOwner: boolean }) {
  const router = useRouter()
  const { remove } = useRemoval()
  const [pending, start] = useTransition()
  const students = members.filter((m) => m.role === 'student').length

  return (
    <Card className="p-4">
      <h2 className="mb-2 text-sm font-semibold">
        成員 <span className="font-normal text-muted">· {students} 位學生</span>
      </h2>
      <ul className="-mx-1 max-h-80 space-y-0.5 overflow-y-auto">
        {members.map((m) => (
          <Removable key={m.userId} id={`member-${m.userId}`}>
            <li className="group flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-paper">
              <span className="min-w-0 flex-1 truncate">
                {m.name}
                {m.userId === me && <span className="text-muted">（我）</span>}
              </span>
              {isOwner && m.role !== 'teacher' ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await setMemberRole(classId, m.userId, m.role === 'student' ? 'assistant' : 'student')
                      router.refresh()
                    })
                  }
                  className="rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-accent-soft hover:text-accent"
                  aria-label={m.role === 'student' ? `把 ${m.name} 設為助教` : `把 ${m.name} 改回學生`}
                >
                  {LABELS[m.role]}
                </button>
              ) : (
                <span className="px-1.5 text-xs text-muted">{LABELS[m.role]}</span>
              )}
              {m.role !== 'teacher' && m.userId !== me && (isOwner || m.role === 'student') && (
                <button
                  type="button"
                  aria-label={`移出 ${m.name}`}
                  onClick={() => remove({ id: `member-${m.userId}`, note: `已把 ${m.name} 移出班級`, commit: () => removeMember(classId, m.userId) })}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:bg-bad-soft hover:text-bad focus-visible:opacity-100 max-sm:opacity-100"
                >
                  <IconTrash size={14} />
                </button>
              )}
            </li>
          </Removable>
        ))}
      </ul>
      {isOwner && members.length > 1 && <p className="mt-2 text-xs text-muted">點身分可以把學生設為助教；助教也能派作業和批改。</p>}
    </Card>
  )
}
