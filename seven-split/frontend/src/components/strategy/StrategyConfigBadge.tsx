import { Badge } from '@/components/ui/Badge'
import { formatKrw, formatPercent, formatSymbol } from '@/lib/format'
import type { SplitStrategyConfigDto } from '@/types/api'

interface Props {
  config: SplitStrategyConfigDto
}

export function StrategyConfigBadge({ config }: Props) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Badge tone="brand">{formatSymbol(config.targetSymbol)}</Badge>
      <Badge>{config.roundCount}회차</Badge>
      <Badge>매수 간격 {formatPercent(config.entryGapPercent)}</Badge>
      <Badge>회차당 {formatKrw(config.initialOrderAmount)}</Badge>
    </div>
  )
}
