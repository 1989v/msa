import { cn } from '@/lib/cn'
import { formatKrw, pnlColorClass, pnlSign } from '@/lib/format'

interface Item {
  roundIndex: number
  realizedPnl: string
  fillCount: number
}

interface Props {
  items: Item[]
}

export function PnLBreakdown({ items }: Props) {
  if (items.length === 0) {
    return <p className="text-sm text-ink-500">회차별 손익 데이터가 없습니다.</p>
  }

  // 절대값 기준으로 막대 비율 계산
  const max = items.reduce((acc, it) => Math.max(acc, Math.abs(Number(it.realizedPnl) || 0)), 0)

  return (
    <ul className="space-y-2">
      {items.map((it) => {
        const value = Number(it.realizedPnl) || 0
        const ratio = max > 0 ? Math.abs(value) / max : 0
        const isPositive = value > 0
        return (
          <li key={it.roundIndex} className="flex items-center gap-3">
            <span className="w-12 shrink-0 text-sm text-ink-500 tabular-nums">
              {it.roundIndex + 1}회차
            </span>
            <div className="flex-1 h-2 rounded-full bg-ink-100 relative overflow-hidden">
              <div
                className={cn(
                  'absolute top-0 h-full rounded-full transition-[width] duration-300 ease-out-expo',
                  isPositive ? 'left-1/2 bg-pnl-up' : 'right-1/2 bg-pnl-down',
                )}
                style={{ width: `${ratio * 50}%` }}
              />
            </div>
            <span
              className={cn(
                'w-28 shrink-0 text-right text-sm font-medium tabular-nums',
                pnlColorClass(it.realizedPnl),
              )}
            >
              {pnlSign(it.realizedPnl)}
              {formatKrw(it.realizedPnl)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
