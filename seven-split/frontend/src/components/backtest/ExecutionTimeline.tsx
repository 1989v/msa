import {
  formatDateTime,
  formatKrw,
  formatNumber,
  pnlColorClass,
  pnlSign,
} from '@/lib/format'
import { cn } from '@/lib/cn'
import type { BacktestFillView } from '@/types/api'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

interface Props {
  fills: BacktestFillView[]
  limit?: number
}

export function ExecutionTimeline({ fills, limit }: Props) {
  const items = limit ? fills.slice(0, limit) : fills

  if (items.length === 0) {
    return <p className="text-sm text-ink-500">체결 내역이 없습니다.</p>
  }

  return (
    <ol className="space-y-2">
      {items.map((fill) => {
        const isBuy = fill.side === 'BUY'
        return (
          <li
            key={`${fill.sequence}-${fill.ts}`}
            className="flex items-start gap-3 rounded-xl bg-white border border-ink-100 px-3 py-2.5"
          >
            <span
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-full shrink-0',
                isBuy
                  ? 'bg-pnl-down/10 text-pnl-down'
                  : 'bg-pnl-up/10 text-pnl-up',
              )}
              aria-label={isBuy ? '매수' : '매도'}
            >
              {isBuy ? <ArrowDownRight size={18} /> : <ArrowUpRight size={18} />}
            </span>
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ink-900">
                  {fill.roundIndex + 1}회차 · {isBuy ? '매수' : '매도'}
                </span>
                <span className="text-xs text-ink-400 tabular-nums">
                  {formatDateTime(fill.ts)}
                </span>
              </div>
              <div className="flex items-baseline gap-3 text-sm text-ink-600 tabular-nums">
                <span>{formatKrw(fill.price)}</span>
                <span aria-hidden className="text-ink-300">×</span>
                <span>{formatNumber(fill.quantity)}</span>
              </div>
              {fill.pnl != null && (
                <div className={cn('text-sm font-medium tabular-nums', pnlColorClass(fill.pnl))}>
                  {pnlSign(fill.pnl)}
                  {formatKrw(fill.pnl)}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
