import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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

  const today = new Date()
  const monthAgo = new Date(today.getTime() - 30 * 86400_000)
  const from = monthAgo.toISOString()
  const to = today.toISOString()

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

      <p className="text-xs text-zinc-500 mt-4">
        ※ 패턴 유사도 / 미래 수익률 예측은 Phase 2 (charting 흡수 시) 추가됩니다.
      </p>
    </div>
  )
}
