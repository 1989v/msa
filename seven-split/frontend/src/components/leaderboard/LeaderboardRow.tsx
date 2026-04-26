import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import {
  formatDate,
  formatKrw,
  formatSymbol,
  pnlColorClass,
  pnlSign,
} from '@/lib/format'
import type { LeaderboardEntry } from '@/types/api'

interface Props {
  entry: LeaderboardEntry
}

export function LeaderboardRow({ entry }: Props) {
  return (
    <Link
      to={`/runs/${entry.runId}`}
      className={cn(
        'flex items-center gap-3 rounded-xl bg-white border border-ink-100 px-3 py-3',
        'transition-transform duration-150 ease-out-expo active:scale-[0.99]',
      )}
    >
      <span
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-full text-base font-semibold tabular-nums shrink-0',
          entry.rank <= 3 ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-700',
        )}
        aria-label={`${entry.rank}위`}
      >
        {entry.rank}
      </span>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="text-base font-medium text-ink-900 truncate">
          {formatSymbol(entry.symbol)}
        </div>
        <div className="text-xs text-ink-500 tabular-nums">
          체결 {entry.fillCount}건 · 종료 {formatDate(entry.endedAt)}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className={cn('text-base font-semibold tabular-nums', pnlColorClass(entry.realizedPnl))}>
          {pnlSign(entry.realizedPnl)}
          {formatKrw(entry.realizedPnl)}
        </div>
        <div className="text-xs text-ink-500 tabular-nums">MDD {entry.mdd}</div>
      </div>
    </Link>
  )
}
