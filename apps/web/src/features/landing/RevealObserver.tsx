'use client'

import { useEffect } from 'react'

/** Marks each `.m-reveal` once it scrolls into view, so it fades up (motion.css). Runs once per element. */
export function RevealObserver() {
  useEffect(() => {
    const seen = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.setAttribute('data-in', '')
          seen.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    )
    document.querySelectorAll('.landing .m-reveal').forEach((el) => seen.observe(el))
    return () => seen.disconnect()
  }, [])
  return null
}
