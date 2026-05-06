import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KpiCard } from '@kgd/design-system'
import { apiClient, unwrap, toApiError } from '@/api/client'
import { OhlcvCandleChart } from '@/components/charts/OhlcvCandleChart'
import type { ApiResponse } from '@/types/api'

type IndicatorType = 'RSI' | 'SMA' | 'EMA' | 'BB'

interface OhlcvBar {
  ts: string
  open: string
  high: string
  low: string
  close: string
  volume: string
}

interface IndicatorSeries {
  type: string
  series: Record<string, Array<{ ts: string; value: string }>>
}

// 백엔드 PredictionQuery.Prediction shape (sample=0 이면 다른 필드 모두 null/[]).
interface PredictionTopHit {
  asset: string
  market: string
  similarity: number
  return5d: string | null
  return20d: string | null
  return60d: string | null
}

interface Prediction {
  sample: number
  avgReturn5d: string | null
  avgReturn20d: string | null
  avgReturn60d: string | null
  topHits: PredictionTopHit[]
}

// 백엔드 PatternEmbeddingRepositoryPort.SimilarityHit shape.
interface SimilarityHit {
  assetCode: string
  marketCode: string
  assetClass: string
  tsWindowEnd: string
  similarity: number
  return5d: string | null
  return20d: string | null
  return60d: string | null
}

function pct(value: string | null | undefined, fractionDigits = 2): string {
  if (value == null) return '—'
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(fractionDigits)}%`
}

/**
 * ChartsPage — /quant/charts (ADR-0033 Phase 1 + Phase 2 charting 흡수).
 *
 * - 자산/거래소/기간/지표 선택 → OHLCV 캔들 + 지표 overlay
 * - 미래 수익률 예측 (k-NN, 5/20/60d 평균)
 * - 유사 패턴 top 20 테이블
 */
export function ChartsPage() {
  const [asset, setAsset] = useState('BTC')
  const [market, setMarket] = useState('BITHUMB')
  const [interval, setInterval] = useState('1d')
  const [indicator, setIndicator] = useState<IndicatorType>('RSI')
  const [period, setPeriod] = useState(14)

  // 무한 refetch 방지 — UTC midnight 고정 (분/초 변동시 queryKey 재계산되어 루프).
  const { from, to } = useMemo(() => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const monthAgo = new Date(today.getTime() - 30 * 86400_000)
    return { from: monthAgo.toISOString(), to: today.toISOString() }
  }, [])

  const ohlcvQ = useQuery({
    queryKey: ['ohlcv', asset, market, interval, from, to],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<OhlcvBar[]>>(
        `/api/v1/charts/ohlcv?asset=${asset}&market=${market}&interval=${interval}&from=${from}&to=${to}`,
      )
      return unwrap(res)
    },
  })

  const indicatorQ = useQuery({
    queryKey: ['indicator', asset, market, interval, from, to, indicator, period],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<IndicatorSeries>>(
        `/api/v1/charts/indicators?asset=${asset}&market=${market}&interval=${interval}&from=${from}&to=${to}&type=${indicator}&period=${period}`,
      )
      return unwrap(res)
    },
  })

  const similarityQ = useQuery({
    queryKey: ['similarity-search', asset, market, to],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SimilarityHit[]>>(
        `/api/v1/charts/similarity/search?asset=${asset}&market=${market}&windowEnd=${to}&windowDays=60&k=20`,
      )
      return unwrap(res)
    },
    retry: false,
  })

  const predictionQ = useQuery({
    queryKey: ['prediction', asset, market],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Prediction>>(
        `/api/v1/charts/prediction?asset=${asset}&market=${market}&windowDays=60&k=50`,
      )
      return unwrap(res)
    },
    retry: false,
  })

  // 디자인 시스템 토큰 기반 input — 다크 카드 안에 자연스럽게 어울리는 form control
  const inputCls =
    'rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400'
  const inputStyle: React.CSSProperties = {
    background: 'var(--ko-surface-2)',
    border: '1px solid var(--ko-border-subtle)',
    color: 'var(--ko-text-primary)',
  }

  // 카드 wrapper 공통 스타일 (디자인 시스템 토큰)
  const cardStyle: React.CSSProperties = {
    background: 'var(--ko-surface-1)',
    border: '1px solid var(--ko-border-subtle)',
    borderRadius: 'var(--ko-radius-lg)',
    padding: 'var(--ko-space-5)',
  }

  return (
    <div
      className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto"
      style={{ color: 'var(--ko-text-primary)' }}
    >
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-bold">차트 분석</h1>
        <p className="text-sm" style={{ color: 'var(--ko-text-muted)' }}>
          OHLCV 캔들 + 기술적 지표 + 패턴 유사도 기반 미래 수익률 예측 (k-NN).
        </p>
      </header>

      <section style={cardStyle}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--ko-text-secondary)' }}>
          조회 조건
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <label className="space-y-1">
            <span className="text-xs" style={{ color: 'var(--ko-text-muted)' }}>자산</span>
            <input
              className={inputCls + ' w-full'}
              style={inputStyle}
              value={asset}
              onChange={(e) => setAsset(e.target.value.toUpperCase())}
              placeholder="BTC"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: 'var(--ko-text-muted)' }}>거래소</span>
            <select
              className={inputCls + ' w-full'}
              style={inputStyle}
              value={market}
              onChange={(e) => setMarket(e.target.value)}
            >
              <option value="BITHUMB">BITHUMB</option>
              <option value="UPBIT">UPBIT</option>
              <option value="YAHOO">YAHOO (Phase 2)</option>
              <option value="FDR_KR">FDR_KR (Phase 2)</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: 'var(--ko-text-muted)' }}>인터벌</span>
            <select
              className={inputCls + ' w-full'}
              style={inputStyle}
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            >
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="1h">1h</option>
              <option value="1d">1d</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: 'var(--ko-text-muted)' }}>지표</span>
            <select
              className={inputCls + ' w-full'}
              style={inputStyle}
              value={indicator}
              onChange={(e) => setIndicator(e.target.value as IndicatorType)}
            >
              <option value="RSI">RSI</option>
              <option value="SMA">SMA</option>
              <option value="EMA">EMA</option>
              <option value="BB">Bollinger</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs" style={{ color: 'var(--ko-text-muted)' }}>period</span>
            <input
              type="number"
              className={inputCls + ' w-full tabular-nums'}
              style={inputStyle}
              value={period}
              onChange={(e) => setPeriod(parseInt(e.target.value || '14', 10))}
              min={2}
              max={500}
            />
          </label>
        </div>
      </section>

      <section style={cardStyle}>
        <h2 className="text-base font-semibold mb-3">
          OHLCV — {asset} @ {market} ({interval})
        </h2>
        {ohlcvQ.isLoading && (
          <div className="text-sm" style={{ color: 'var(--ko-text-muted)' }}>로딩 중…</div>
        )}
        {ohlcvQ.isError && (
          <div className="text-sm" style={{ color: 'var(--ko-status-loss)' }}>
            에러: {toApiError(ohlcvQ.error).message}
          </div>
        )}
        {ohlcvQ.data && ohlcvQ.data.length > 0 && (
          <OhlcvCandleChart bars={ohlcvQ.data} indicator={indicatorQ.data} />
        )}
        {ohlcvQ.data && ohlcvQ.data.length === 0 && (
          <div className="text-sm" style={{ color: 'var(--ko-text-muted)' }}>
            데이터 없음 (ingest 가 아직 적재하지 않았습니다)
          </div>
        )}
      </section>

      <section style={cardStyle}>
        <h2 className="text-base font-semibold mb-3">
          미래 수익률 예측 (k-NN, 과거 유사 패턴 평균)
        </h2>
        {predictionQ.isLoading && (
          <div className="text-sm" style={{ color: 'var(--ko-text-muted)' }}>예측 계산 중…</div>
        )}
        {predictionQ.isError && (
          <div className="text-sm" style={{ color: 'var(--ko-text-muted)' }}>
            예측 불가 — {toApiError(predictionQ.error).message}
          </div>
        )}
        {predictionQ.data && (
          <>
            {predictionQ.data.sample === 0 ? (
              <div
                className="rounded p-4 text-sm"
                style={{
                  background: 'var(--ko-surface-2)',
                  border: '1px solid var(--ko-border-subtle)',
                  color: 'var(--ko-text-secondary)',
                }}
              >
                유사 패턴이 발견되지 않았습니다 (히스토리 부족 또는 pgvector 인덱스 미적재).
                <span className="block text-xs mt-1" style={{ color: 'var(--ko-text-muted)' }}>
                  ingest sidecar 로 60+ 일 OHLCV 적재 후 임베딩 백필 필요.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard label="샘플 (k)" value={predictionQ.data.sample} />
                <KpiCard
                  label="평균 5d 수익률"
                  value={pct(predictionQ.data.avgReturn5d)}
                  deltaTone={
                    parseFloat(predictionQ.data.avgReturn5d ?? '0') > 0 ? 'profit' : 'loss'
                  }
                />
                <KpiCard
                  label="평균 20d 수익률"
                  value={pct(predictionQ.data.avgReturn20d)}
                  deltaTone={
                    parseFloat(predictionQ.data.avgReturn20d ?? '0') > 0 ? 'profit' : 'loss'
                  }
                />
                <KpiCard
                  label="평균 60d 수익률"
                  value={pct(predictionQ.data.avgReturn60d)}
                  deltaTone={
                    parseFloat(predictionQ.data.avgReturn60d ?? '0') > 0 ? 'profit' : 'loss'
                  }
                />
              </div>
            )}
          </>
        )}
      </section>

      <section style={cardStyle}>
        <h2 className="text-base font-semibold mb-3">유사 패턴 — 과거 유사 구간 (top 20)</h2>
        {similarityQ.isLoading && (
          <div className="text-sm" style={{ color: 'var(--ko-text-muted)' }}>유사 구간 검색 중…</div>
        )}
        {similarityQ.isError && (
          <div className="text-sm" style={{ color: 'var(--ko-text-muted)' }}>
            유사도 검색 불가 — {toApiError(similarityQ.error).message}
          </div>
        )}
        {similarityQ.data && similarityQ.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr
                  className="text-left text-xs uppercase tracking-wide"
                  style={{
                    color: 'var(--ko-text-muted)',
                    borderBottom: '1px solid var(--ko-border-subtle)',
                  }}
                >
                  <th className="py-2 px-2">자산</th>
                  <th className="py-2 px-2">거래소</th>
                  <th className="py-2 px-2">윈도우 종료</th>
                  <th className="py-2 px-2 text-right">유사도</th>
                  <th className="py-2 px-2 text-right">5d 수익률</th>
                  <th className="py-2 px-2 text-right">20d 수익률</th>
                </tr>
              </thead>
              <tbody>
                {similarityQ.data.map((hit, i) => (
                  <tr
                    key={`${hit.assetCode}-${hit.tsWindowEnd}-${i}`}
                    className="last:border-0"
                    style={{ borderBottom: '1px solid var(--ko-border-subtle)' }}
                  >
                    <td className="py-2 px-2 font-medium">{hit.assetCode}</td>
                    <td className="py-2 px-2" style={{ color: 'var(--ko-text-secondary)' }}>
                      {hit.marketCode}
                    </td>
                    <td
                      className="py-2 px-2 tabular-nums text-xs"
                      style={{ color: 'var(--ko-text-secondary)' }}
                    >
                      {hit.tsWindowEnd.slice(0, 10)}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {(hit.similarity * 100).toFixed(1)}%
                    </td>
                    <td
                      className="py-2 px-2 text-right tabular-nums"
                      style={{
                        color:
                          parseFloat(hit.return5d ?? '0') >= 0
                            ? 'var(--ko-status-profit)'
                            : 'var(--ko-status-loss)',
                      }}
                    >
                      {pct(hit.return5d)}
                    </td>
                    <td
                      className="py-2 px-2 text-right tabular-nums"
                      style={{
                        color:
                          parseFloat(hit.return20d ?? '0') >= 0
                            ? 'var(--ko-status-profit)'
                            : 'var(--ko-status-loss)',
                      }}
                    >
                      {pct(hit.return20d)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {similarityQ.data && similarityQ.data.length === 0 && (
          <div className="text-sm" style={{ color: 'var(--ko-text-muted)' }}>
            유사 패턴 없음 — pgvector 인덱스에 충분한 임베딩이 없거나 60+ 일 히스토리 부족.
          </div>
        )}
      </section>
    </div>
  )
}
