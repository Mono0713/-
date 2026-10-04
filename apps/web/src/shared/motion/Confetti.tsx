'use client'

import { useEffect, useRef } from 'react'

/**
 * Hole-punch confetti (Stripe and Linear's confetti, as paper dots from a ring binder): one burst
 * of small discs in ballpoint blue, highlighter, red pen and paper grey, falling with a flutter.
 * Fills the box `className` gives it inside a positioned parent, bursts from near its bottom
 * middle and plays once when mounted.
 */
export function Confetti({ delay = 400, className = 'inset-0' }: { delay?: number; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = canvas.current
    const cx = cv?.getContext('2d')
    if (!cv || !cx || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const timer = setTimeout(() => {
      const r = cv.getBoundingClientRect(), dpr = devicePixelRatio || 1
      cv.width = r.width * dpr
      cv.height = r.height * dpr
      cx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const css = getComputedStyle(document.documentElement)
      const colors = ['--color-accent', '--color-hl', '--color-pen', '--color-line'].map((v) => css.getPropertyValue(v).trim())
      const bits = Array.from({ length: 70 }, (_, i) => {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9, v = 4 + Math.random() * 5
        return { x: r.width / 2, y: r.height * 0.75, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2.5 + Math.random() * 3, c: colors[i % 4]!, s: Math.random() * 6.28, w: 0.5 + Math.random() }
      })
      const start = performance.now()
      const frame = (now: number) => {
        cx.clearRect(0, 0, r.width, r.height)
        for (const b of bits) {
          b.vy += 0.22
          b.vx *= 0.985
          b.x += b.vx
          b.y += b.vy
          b.s += 0.15
          cx.fillStyle = b.c
          cx.beginPath()
          cx.ellipse(b.x, b.y, b.r, b.r * Math.abs(Math.cos(b.s)) * b.w + 0.6, 0, 0, 6.28)
          cx.fill()
        }
        if (now - start < 2200) raf = requestAnimationFrame(frame)
        else cx.clearRect(0, 0, r.width, r.height)
      }
      raf = requestAnimationFrame(frame)
    }, delay)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [delay])
  return <canvas ref={canvas} aria-hidden className={`pointer-events-none absolute ${className}`} />
}
