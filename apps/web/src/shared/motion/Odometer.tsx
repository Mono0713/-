'use client'

import { useEffect, useState } from 'react'

const DIGITS = '0123456789'

/**
 * A number whose digits roll into place like a mileage counter, one column after another.
 * Other characters (".", "%") stay put. Under reduced motion the digits simply appear.
 */
export function Odometer({ value, className = '' }: { value: string; className?: string }) {
  // Starts at all zeros so the first render after hydration rolls up to the value.
  const [shown, setShown] = useState(() => value.replace(/\d/g, '0'))
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(id)
  }, [value])
  return (
    <span className={`inline-flex tabular-nums ${className}`} aria-label={value}>
      {[...shown].map((ch, i) =>
        DIGITS.includes(ch) ? (
          <span key={i} className="m-odo-col" aria-hidden>
            <span style={{ transform: `translateY(-${Number(ch)}em)`, transitionDelay: `${i * 80}ms` }}>
              {[...DIGITS].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden>
            {ch}
          </span>
        ),
      )}
    </span>
  )
}
