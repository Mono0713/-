'use client'

import { useTransition } from 'react'
import { Button } from '@/shared/ui'
import { deleteImport } from './actions'

export function DeleteImportButton({ importId }: { importId: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      variant="danger"
      disabled={pending}
      onClick={() => confirm('刪除這次匯入的檔案和草稿？已存入題庫的題目會保留。') && start(() => deleteImport(importId))}
    >
      刪除匯入
    </Button>
  )
}
