// charting/components/PriceFlash.tsx
//
// 가격 변경 시 짧은 background flash (rise=red(KR 시세관습)/fall=blue, < 600ms).
// prefers-reduced-motion: reduce 시 비활성.
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface Props {
  /** 현재 가격 — 변경 detect 기준. */
  price: number | null
  children: ReactNode
  /** Flash 지속 시간 (ms, default 500). */
  durationMs?: number
}

type FlashTone = 'rise' | 'fall' | null

export function PriceFlash({ price, children, durationMs = 500 }: Props) {
  const [tone, setTone] = useState<FlashTone>(null)
  const lastPriceRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (price == null || !Number.isFinite(price)) return
    const prev = lastPriceRef.current
    lastPriceRef.current = price
    if (prev == null) return
    if (price === prev) return

    // prefers-reduced-motion 시 flash 비활성
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }

    setTone(price > prev ? 'rise' : 'fall')
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
    }
    timerRef.current = window.setTimeout(() => {
      setTone(null)
      timerRef.current = null
    }, durationMs)
  }, [price, durationMs])

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const bg =
    tone === 'rise'
      ? 'color-mix(in oklch, var(--ko-quote-rise) 24%, transparent)'
      : tone === 'fall'
        ? 'color-mix(in oklch, var(--ko-quote-fall) 24%, transparent)'
        : 'transparent'

  return (
    <span
      style={{
        background: bg,
        transition: `background-color ${durationMs}ms ease-out`,
        borderRadius: 4,
        padding: tone ? '2px 6px' : 0,
        margin: tone ? '-2px -6px' : 0,
      }}
    >
      {children}
    </span>
  )
}
