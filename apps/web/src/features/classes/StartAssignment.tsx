'use client'

import { useState, useTransition } from 'react'
import { Button, ButtonLink } from '@/shared/ui'
import { startAssignment } from './actions'

/** Start, or go back to the attempt under way. */
export function StartAssignment({ assignmentId, resume, label }: { assignmentId: string; resume: string | null; label: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  if (resume) {
    return (
      <ButtonLink href={`/quiz/${resume}`} variant="primary">
        繼續作答
      </ButtonLink>
    )
  }
  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        loading={pending}
        disabled={pending}
        onClick={() =>
          start(async () => {
            // On success it opens the quiz.
            setError((await startAssignment(assignmentId))?.error ?? null)
          })
        }
      >
        {label}
      </Button>
      {error && <p className="m-shake text-sm text-bad">{error}</p>}
    </div>
  )
}
