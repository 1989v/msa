import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import {
  daysBetween,
  formatDateTime,
  formatKrw,
  formatSymbol,
  pnlColorClass,
  pnlSign,
} from '@/lib/format'
import { cn } from '@/lib/cn'
import type { BacktestRunSummaryView } from '@/types/api'

interface Props {
  run: BacktestRunSummaryView
  /** 클릭 시 이동 경로 (기본: /runs/:runId) */
  href?: string
  compact?: boolean
}

export function BacktestSummaryCard({ run, href, compact }: Props) {
  const target = href ?? `/runs/${run.runId}`
  const days = daysBetween(run.fromTs, run.toTs)
  const pnlClass = pnlColorClass(run.realizedPnl)

  return (
    <Link
      to={target}
      className="block transition-transform duration-150 ease-out-expo active:scale-[0.99]"
    >
      <Card className={cn('space-y-3', compact && 'py-3')}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-ink-500">
            {formatSymbol(run.symbol)} · {days}일
          </span>
          <span className="text-xs text-ink-400 tabular-nums">
            {formatDateTime(run.endedAt)}
          </span>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className={cn('text-xl font-semibold tabular-nums', pnlClass)}>
              {pnlSign(run.realizedPnl)}
              {formatKrw(run.realizedPnl)}
            </div>
            <div className="text-sm text-ink-500 tabular-nums">
              체결 {run.fillCount.toLocaleString('ko-KR')}건
            </div>
          </div>
          {!compact && run.mdd && (
            <div className="text-right">
              <div className="text-sm text-ink-500">MDD</div>
              <div className="text-base font-medium tabular-nums text-pnl-down">
                {run.mdd}
              </div>
            </div>
          )}
        </div>
      </Card>
    </Link>
  )
}
