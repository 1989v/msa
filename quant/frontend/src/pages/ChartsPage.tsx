import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap, toApiError } from '@/api/client'
import { OhlcvCandleChart } from '@/components/charts/OhlcvCandleChart'
import type { ApiResponse } from '@/types/api'

type IndicatorType = 'RSI' | 'SMA' | 'EMA' | 'BB'

interface SimilarityHit {
  asset: string
  market: string
  windowEnd: string
  score: number
  futureReturnPct: number | null
}

interface Prediction {
  expectedReturnPct: number
  confidence: number
  k: number
  basis: string
}

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

/**
 * ChartsPage — /quant/charts (ADR-0033 Phase 1).
 *
 * Phase 1 placeholder UI — 자산/거래소/기간/지표 선택 후 OHLCV + 지표 시계열을 표 형태로 조회.
 * lightweight-charts 통합은 Phase 1 후반 — charting 흡수와 함께 PatternSimilarityPanel 도 합류.
 */
export function ChartsPage() {
  const [asset, setAsset] = useState('BTC')
  const [market, setMarket] = useState('BITHUMB')
  const [interval, setInterval] = useState('1d')
  const [indicator, setIndicator] = useState<IndicatorType>('RSI')
  const [period, setPeriod] = useState(14)

  // 무한 refetch 방지 — from/to 를 일 단위로 고정 (분/초가 매 렌더 갱신되어
  // queryKey 가 매번 바뀌면 react-query 가 무한 루프).
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
        `/api/v1/charts/ohlcv?asset=${asset}&market=${market}&interval=${interval}&from=${from}&to=${to}`
      )
      return unwrap(res)
    },
  })

  const indicatorQ = useQuery({
    queryKey: ['indicator', asset, market, interval, from, to, indicator, period],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<IndicatorSeries>>(
        `/api/v1/charts/indicators?asset=${asset}&market=${market}&interval=${interval}&from=${from}&to=${to}&type=${indicator}&period=${period}`
      )
      return unwrap(res)
    },
  })

  // Phase 2 charting 흡수 — 패턴 유사도 (k-NN) + 미래 수익률 예측
  // (ChartController 에 /similarity/search, /prediction endpoint 이미 존재)
  const similarityQ = useQuery({
    queryKey: ['similarity-search', asset, market, to],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SimilarityHit[]>>(
        `/api/v1/charts/similarity/search?asset=${asset}&market=${market}&windowEnd=${to}&windowDays=60&k=20`
      )
      return unwrap(res)
    },
    retry: false,
  })

  const predictionQ = useQuery({
    queryKey: ['prediction', asset, market],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Prediction>>(
        `/api/v1/charts/prediction?asset=${asset}&market=${market}&windowDays=60&k=50`
      )
      return unwrap(res)
    },
    retry: false,
  })

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold">차트 분석</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <input
          className="border rounded px-2 py-1"
          value={asset}
          onChange={(e) => setAsset(e.target.value.toUpperCase())}
          placeholder="자산 (예: BTC)"
        />
        <select
          className="border rounded px-2 py-1"
          value={market}
          onChange={(e) => setMarket(e.target.value)}
        >
          <option value="BITHUMB">BITHUMB</option>
          <option value="UPBIT">UPBIT</option>
          <option value="YAHOO">YAHOO (Phase 2)</option>
          <option value="FDR_KR">FDR_KR (Phase 2)</option>
        </select>
        <select
          className="border rounded px-2 py-1"
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
        >
          <option value="1m">1m</option>
          <option value="5m">5m</option>
          <option value="1h">1h</option>
          <option value="1d">1d</option>
        </select>
        <select
          className="border rounded px-2 py-1"
          value={indicator}
          onChange={(e) => setIndicator(e.target.value as IndicatorType)}
        >
          <option value="RSI">RSI</option>
          <option value="SMA">SMA</option>
          <option value="EMA">EMA</option>
          <option value="BB">Bollinger</option>
        </select>
        <input
          type="number"
          className="border rounded px-2 py-1"
          value={period}
          onChange={(e) => setPeriod(parseInt(e.target.value || '14', 10))}
          placeholder="period"
          min={2}
          max={500}
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold mt-4 mb-2">OHLCV — {asset} @ {market} ({interval})</h2>
        {ohlcvQ.isLoading && <div>로딩...</div>}
        {ohlcvQ.isError && (
          <div className="text-red-500">에러: {toApiError(ohlcvQ.error).message}</div>
        )}
        {ohlcvQ.data && ohlcvQ.data.length > 0 && (
          <OhlcvCandleChart bars={ohlcvQ.data} indicator={indicatorQ.data} />
        )}
        {ohlcvQ.data && ohlcvQ.data.length === 0 && (
          <div className="text-sm text-zinc-500">데이터 없음 (ingest 가 아직 적재하지 않았습니다)</div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mt-4 mb-2">미래 수익률 예측 (k-NN, charting 흡수)</h2>
        {predictionQ.isLoading && <div>예측 계산 중...</div>}
        {predictionQ.isError && (
          <div className="text-sm text-zinc-500">
            예측 불가 — {toApiError(predictionQ.error).message}
          </div>
        )}
        {predictionQ.data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="border rounded p-3">
              <div className="text-xs text-zinc-500">예상 수익률</div>
              <div className="text-xl font-bold tabular-nums">
                {(predictionQ.data.expectedReturnPct * 100).toFixed(2)}%
              </div>
            </div>
            <div className="border rounded p-3">
              <div className="text-xs text-zinc-500">신뢰도</div>
              <div className="text-xl font-bold tabular-nums">
                {(predictionQ.data.confidence * 100).toFixed(1)}%
              </div>
            </div>
            <div className="border rounded p-3">
              <div className="text-xs text-zinc-500">k (이웃 수)</div>
              <div className="text-xl font-bold tabular-nums">{predictionQ.data.k}</div>
            </div>
            <div className="border rounded p-3">
              <div className="text-xs text-zinc-500">근거</div>
              <div className="text-sm">{predictionQ.data.basis}</div>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mt-4 mb-2">패턴 유사도 — 과거 유사 구간 (top 20)</h2>
        {similarityQ.isLoading && <div>유사 구간 검색 중...</div>}
        {similarityQ.isError && (
          <div className="text-sm text-zinc-500">
            유사도 검색 불가 — {toApiError(similarityQ.error).message}
          </div>
        )}
        {similarityQ.data && similarityQ.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1 px-2">자산</th>
                  <th className="py-1 px-2">거래소</th>
                  <th className="py-1 px-2">윈도우 종료</th>
                  <th className="py-1 px-2 text-right">유사도</th>
                  <th className="py-1 px-2 text-right">이후 수익률</th>
                </tr>
              </thead>
              <tbody>
                {similarityQ.data.map((hit, i) => (
                  <tr key={`${hit.asset}-${hit.windowEnd}-${i}`} className="border-b">
                    <td className="py-1 px-2">{hit.asset}</td>
                    <td className="py-1 px-2">{hit.market}</td>
                    <td className="py-1 px-2 tabular-nums text-xs">{hit.windowEnd.slice(0, 10)}</td>
                    <td className="py-1 px-2 text-right tabular-nums">
                      {(hit.score * 100).toFixed(1)}%
                    </td>
                    <td className="py-1 px-2 text-right tabular-nums">
                      {hit.futureReturnPct == null
                        ? '—'
                        : `${(hit.futureReturnPct * 100).toFixed(2)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {similarityQ.data && similarityQ.data.length === 0 && (
          <div className="text-sm text-zinc-500">유사 패턴 없음 (히스토리 부족)</div>
        )}
      </section>
    </div>
  )
}
