// charting/components/InvestorFlowsPanel.tsx — ADR-0040 매매주체 동향 패널.
//
// 토스 스타일 개인·외국인·기관 순매수/매도 표시.
// KR 주식 전용 (market=FDR_KR). 다른 자산 클래스는 caller 가 placeholder 표시.
import type { InvestorFlowItem } from '@/charting/hooks/useInvestorFlows'

interface Props {
  flows: InvestorFlowItem[]
  loading?: boolean
  error?: boolean
  isKr: boolean
}

export function InvestorFlowsPanel({ flows, loading, error, isKr }: Props) {
  if (!isKr) {
    return (
      <p
        className="py-6 text-center text-sm"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        매매주체 동향은 국내 주식 (FDR_KR) 전용입니다.
      </p>
    )
  }
  if (loading) {
    return (
      <p
        className="py-6 text-center text-sm"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        매매주체 데이터 불러오는 중…
      </p>
    )
  }
  if (error || flows.length === 0) {
    return (
      <p
        className="py-6 text-center text-sm"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        매매주체 데이터가 없습니다 (pykrx ingest 미적재 또는 외부 source 응답 실패).
      </p>
    )
  }

  // 최신 일자
  const sorted = [...flows].sort((a, b) =>
    a.tradeDate.localeCompare(b.tradeDate),
  )
  const latest = sorted[sorted.length - 1]

  return (
    <div className="space-y-3">
      {/* 최신 일자 카드 3종 */}
      <div className="grid grid-cols-3 gap-2">
        <KpiCard
          label="개인"
          netVolume={latest.individualNet}
        />
        <KpiCard
          label="외국인"
          netVolume={latest.foreignNet}
        />
        <KpiCard
          label="기관"
          netVolume={latest.institutionNet}
        />
      </div>

      {/* 일별 표 */}
      <div
        className="rounded-lg overflow-hidden"
        style={{
          background: 'var(--ko-surface-2)',
          border: '1px solid var(--ko-border-subtle)',
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-xs uppercase tracking-wide"
              style={{
                color: 'var(--ko-text-muted)',
                borderBottom: '1px solid var(--ko-border-subtle)',
              }}
            >
              <th className="py-2 px-3">일자</th>
              <th className="py-2 px-3 text-right">개인</th>
              <th className="py-2 px-3 text-right">외국인</th>
              <th className="py-2 px-3 text-right">기관</th>
            </tr>
          </thead>
          <tbody>
            {sorted
              .slice(-14)
              .reverse()
              .map(f => (
                <tr
                  key={f.tradeDate}
                  style={{
                    borderBottom: '1px solid var(--ko-border-subtle)',
                  }}
                >
                  <td className="py-2 px-3 tabular-nums text-xs">
                    {f.tradeDate}
                  </td>
                  <NetCell value={f.individualNet} />
                  <NetCell value={f.foreignNet} />
                  <NetCell value={f.institutionNet} />
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function KpiCard({ label, netVolume }: { label: string; netVolume: number }) {
  const isPositive = netVolume >= 0
  const color = isPositive
    ? 'var(--ko-quote-rise)'
    : 'var(--ko-quote-fall)'
  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: 'var(--ko-surface-2)',
        border: '1px solid var(--ko-border-subtle)',
      }}
    >
      <div
        className="text-[10px] uppercase tracking-wide"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 text-base font-semibold tabular-nums"
        style={{ color }}
      >
        {isPositive ? '+' : ''}
        {formatCompactCount(Math.abs(netVolume))}
      </div>
    </div>
  )
}

function NetCell({ value }: { value: number }) {
  const isPositive = value >= 0
  const color = value === 0
    ? 'var(--ko-text-muted)'
    : isPositive
      ? 'var(--ko-quote-rise)'
      : 'var(--ko-quote-fall)'
  return (
    <td
      className="py-2 px-3 text-right tabular-nums"
      style={{ color }}
    >
      {isPositive && value !== 0 ? '+' : ''}
      {formatCompactCount(value, true)}
    </td>
  )
}

function formatCompactCount(n: number, signed = false): string {
  if (!Number.isFinite(n)) return '—'
  const sign = signed && n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1e8) return `${sign}${(abs / 1e8).toFixed(1)}억`
  if (abs >= 1e4) return `${sign}${(abs / 1e4).toFixed(0)}만`
  return `${sign}${abs.toLocaleString()}`
}
