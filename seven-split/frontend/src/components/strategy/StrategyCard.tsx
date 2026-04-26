import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { formatDate, formatSymbol } from '@/lib/format'
import type { StrategySummaryView } from '@/types/api'

interface Props {
  strategy: StrategySummaryView
}

export function StrategyCard({ strategy }: Props) {
  return (
    <Link
      to={`/strategies/${strategy.strategyId}`}
      className="block transition-transform duration-150 ease-out-expo active:scale-[0.99]"
    >
      <Card className="flex items-center gap-3">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-semibold text-ink-900">
              {formatSymbol(strategy.targetSymbol)}
            </span>
            <StatusBadge status={strategy.status} />
          </div>
          <div className="flex items-center gap-3 text-sm text-ink-500 tabular-nums">
            <span>{strategy.roundCount}회차</span>
            <span aria-hidden>·</span>
            <span>생성 {formatDate(strategy.createdAt)}</span>
            {strategy.runCount !== undefined && (
              <>
                <span aria-hidden>·</span>
                <span>백테스트 {strategy.runCount}회</span>
              </>
            )}
          </div>
        </div>
        <ChevronRight size={20} className="text-ink-300 shrink-0" aria-hidden />
      </Card>
    </Link>
  )
}
