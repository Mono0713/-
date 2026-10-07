'use client'

import { useEffect } from 'react'

/**
 * Copying text that shows formulas puts their LaTeX on the clipboard ($…$), so a question copied
 * from anywhere on the site pastes back as the same text and formulas. Loaded once, in the browser.
 */
export function CopyFormulas() {
  useEffect(() => {
    void import('katex/contrib/copy-tex')
  }, [])
  return null
}
