'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Menu } from '@/shared/chrome/Menu'
import { IconMore, IconTrash } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { Button, inputClass } from '@/shared/ui'
import { deleteClass, leaveClass, renameClass } from './actions'

/** The class's ⋯ menu: its name and deleting it for the teacher, leaving it for everyone else. */
export function ClassMenu({ classId, name, role }: { classId: string; name: string; role: 'owner' | 'assistant' | 'student' }) {
  const router = useRouter()
  const { remove } = useRemoval()
  const [title, setTitle] = useState(name)
  const [, start] = useTransition()
  const away = (note: string, commit: () => Promise<unknown>) => {
    remove({ id: classId, note, commit })
    router.push('/classes')
  }

  return (
    <Menu label="班級設定" align="right" className="m-press grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-ink/[0.05] hover:text-ink" button={<IconMore size={18} />}>
      <div className="w-64 space-y-3 p-2">
        {role !== 'student' && (
          <label className="block space-y-1">
            <span className="text-xs text-muted">班級名稱</span>
            <input
              autoComplete="off"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() =>
                title.trim() &&
                title !== name &&
                start(async () => {
                  await renameClass(classId, title)
                  router.refresh()
                })
              }
              className={inputClass}
            />
          </label>
        )}
        {role === 'owner' ? (
          <Button variant="danger" className="w-full" icon={<IconTrash size={15} />} aria-label="刪除班級" onClick={() => away('已刪除班級', () => deleteClass(classId))} />
        ) : (
          <Button variant="danger" className="w-full" onClick={() => away('已退出班級', () => leaveClass(classId))}>
            退出班級
          </Button>
        )}
      </div>
    </Menu>
  )
}
