import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

interface Props {
    symbol: string
    /** BigDecimal serialized 가격 문자열 */
    price: string | null
    connected: boolean
}

type Highlight = 'up' | 'down' | null

/**
 * 실시간 시세 패널.
 *
 * - 가격 변동 시 0.5초 highlight (한국 관습: 양수=빨강, 음수=파랑)
 * - tabular-nums 로 자릿수 흔들림 방지
 * - 연결 상태 인디케이터
 */
export function RealtimePricePanel({ symbol, price, connected }: Props) {
    const [highlight, setHighlight] = useState<Highlight>(null)
    const prevPriceRef = useRef<string | null>(null)

    useEffect(() => {
        const prev = prevPriceRef.current
        if (price && prev && price !== prev) {
            const isUp = parseFloat(price) > parseFloat(prev)
            setHighlight(isUp ? 'up' : 'down')
            const t = window.setTimeout(() => setHighlight(null), 500)
            prevPriceRef.current = price
            return () => window.clearTimeout(t)
        }
        // 최초 가격 도착 또는 동일가 → highlight 없이 prev 만 갱신
        if (price !== prev) {
            prevPriceRef.current = price
        }
        return undefined
    }, [price])

    const colorClass =
        highlight === 'up'
            ? 'text-pnl-up'
            : highlight === 'down'
              ? 'text-pnl-down'
              : 'text-ink-900'

    const displaySymbol = symbol.replace('_', '/')

    return (
        <section
            aria-label="실시간 시세"
            className="rounded-2xl border border-ink-200 bg-white p-6"
        >
            <div className="text-sm text-ink-500 mb-2">{displaySymbol}</div>
            <div
                className={cn(
                    'text-2xl font-bold tabular-nums transition-colors duration-200',
                    colorClass,
                )}
                aria-live="polite"
            >
                {price ? Number(price).toLocaleString() : '—'}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-ink-500">
                <span
                    aria-hidden
                    className={cn(
                        'inline-block h-2 w-2 rounded-full',
                        connected ? 'bg-status-active' : 'bg-pnl-down',
                    )}
                />
                <span>{connected ? '실시간 연결' : '재연결 중'}</span>
            </div>
        </section>
    )
}
