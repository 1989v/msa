import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KpiCard } from '@kgd/design-system'
import { apiClient, unwrap, toApiError } from '@/api/client'
import type { ApiResponse } from '@/types/api'

// 부활된 charting 모듈 — ADR-0036 P2-T20 hard-remove 이전의 기능들
import { fetchSymbols, type Symbol as ChartSymbol, type OhlcvBar } from '@/charting/api'
import { PatternChart } from '@/charting/components/PatternChart'
import { PatternSelector } from '@/charting/components/PatternSelector'
import { PeriodSelector } from '@/charting/components/PeriodSelector'
import { SymbolSearch } from '@/charting/components/SymbolSearch'
import {
  IndicatorToggle,
  DEFAULT_PARAMS,
  type Indicators,
  type IndicatorParams,
} from '@/charting/components/IndicatorToggle'
import { ChartToolbar } from '@/charting/components/ChartToolbar'
import { PredictionPanel } from '@/charting/components/PredictionPanel'
import type { ChartType } from '@/charting/types'
import { matchPatterns } from '@/charting/lib/patternMatcher'
import { PATTERNS as ALL_PATTERNS } from '@/charting/lib/patterns'

// === 백엔드 prediction / similarity 응답 타입 (ChartController 일치) ===
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

const DEFAULT_INDICATORS: Indicators = {
  ma5: false,
  ma20: true,
  ma60: false,
  ma120: false,
  bb: false,
  volume: true,
  rsi: true,
  macd: false,
  stochastic: false,
  williamsR: false,
  atr: false,
  obv: false,
  vwap: false,
}

/**
 * ChartsPage — quant 통합 차트 분석 (charting 부활 + sample 1/2 톤).
 *
 * 구성:
 *   1. SymbolSearch — 종목 자동완성
 *   2. PeriodSelector — 기간 (분봉/시간봉/일봉)
 *   3. ChartToolbar — 차트 종류 (candle/line/area)
 *   4. IndicatorToggle — 다중 지표 (MA / BB / RSI / MACD / Stoch / ATR / OBV / VWAP)
 *   5. PatternChart — 캔들 + 지표 overlay + 패턴 매칭
 *   6. PatternSelector — 인식된 차트 패턴 (8 종)
 *   7. PredictionPanel — 미래 수익률 예측 (k-NN)
 *   8. 유사 패턴 테이블 (top 20)
 */
export function ChartsPage() {
  const [symbol, setSymbol] = useState<ChartSymbol>({ code: 'BTC', name: '비트코인', market: 'BITHUMB' })
  const [interval, setInterval] = useState('1d')
  const [chartType, setChartType] = useState<ChartType>('candle')
  const [indicators, setIndicators] = useState<Indicators>(DEFAULT_INDICATORS)
  const [indicatorParams, setIndicatorParams] = useState<IndicatorParams>(DEFAULT_PARAMS)
  const [selectedPatternIds, setSelectedPatternIds] = useState<Set<string>>(new Set())
  const [patternOffset, setPatternOffset] = useState<number | null>(null)
  const [patternWidth, setPatternWidth] = useState<number>(60)

  // SymbolSearch 가 호출하는 fetcher
  const symbolsQuery = useQuery({
    queryKey: ['charting-symbols', ''],
    queryFn: () => fetchSymbols(''),
  })

  // 기간 — 무한 refetch 방지 (UTC midnight 고정)
  const { from, to } = useMemo(() => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const monthAgo = new Date(today.getTime() - 30 * 86400_000)
    return { from: monthAgo.toISOString(), to: today.toISOString() }
  }, [])

  // OHLCV — quant /api/v1/charts/ohlcv
  const ohlcvQ = useQuery({
    queryKey: ['ohlcv', symbol.code, symbol.market, interval, from, to],
    queryFn: async (): Promise<OhlcvBar[]> => {
      const qs = new URLSearchParams({
        asset: symbol.code,
        market: symbol.market,
        interval,
        from,
        to,
      }).toString()
      const res = await apiClient.get<
        ApiResponse<Array<{ ts: string; open: string | number; high: string | number; low: string | number; close: string | number; volume: string | number }>>
      >(`/api/v1/charts/ohlcv?${qs}`)
      const data = unwrap(res)
      return data.map((b) => ({
        ts: b.ts,
        open: Number(b.open),
        high: Number(b.high),
        low: Number(b.low),
        close: Number(b.close),
        volume: Number(b.volume),
      }))
    },
  })

  // 패턴 매칭 (client-side)
  const matches = useMemo(() => {
    if (!ohlcvQ.data || ohlcvQ.data.length < 20) return []
    const closes = ohlcvQ.data.map((b) => b.close)
    return matchPatterns(closes, ALL_PATTERNS).slice(0, 8)
  }, [ohlcvQ.data])

  const selectedPatterns = useMemo(
    () => ALL_PATTERNS.filter((p) => selectedPatternIds.has(p.id)),
    [selectedPatternIds],
  )

  const togglePattern = (id: string) => {
    setSelectedPatternIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Prediction
  const predictionQ = useQuery({
    queryKey: ['prediction', symbol.code, symbol.market],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Prediction>>(
        `/api/v1/charts/prediction?asset=${symbol.code}&market=${symbol.market}&windowDays=60&k=50`,
      )
      return unwrap(res)
    },
    retry: false,
  })

  // Similarity (top 20)
  const similarityQ = useQuery({
    queryKey: ['similarity-search', symbol.code, symbol.market, to],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SimilarityHit[]>>(
        `/api/v1/charts/similarity/search?asset=${symbol.code}&market=${symbol.market}&windowEnd=${to}&windowDays=60&k=20`,
      )
      return unwrap(res)
    },
    retry: false,
  })

  // PredictionPanel 컴포넌트가 요구하는 단일 객체 형태로 변환 (legacy)
  const predictionForPanel = useMemo(() => {
    if (!predictionQ.data) return null
    const p = predictionQ.data
    return {
      sample: p.sample,
      avgReturn5d: p.avgReturn5d != null ? Number(p.avgReturn5d) : null,
      avgReturn20d: p.avgReturn20d != null ? Number(p.avgReturn20d) : null,
      avgReturn60d: p.avgReturn60d != null ? Number(p.avgReturn60d) : null,
      topHits: p.topHits.map((h) => ({
        asset: h.asset,
        market: h.market,
        similarity: h.similarity,
        return5d: h.return5d != null ? Number(h.return5d) : null,
        return20d: h.return20d != null ? Number(h.return20d) : null,
        return60d: h.return60d != null ? Number(h.return60d) : null,
      })),
    }
  }, [predictionQ.data])

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
          OHLCV 캔들 + 기술적 지표 + 패턴 매칭 + k-NN 미래 수익률 예측 (charting 부활).
        </p>
      </header>

      {/* 1. 종목 / 기간 / 차트 종류 */}
      <section style={cardStyle} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--ko-text-muted)' }}>
              종목
            </label>
            <SymbolSearch
              symbols={symbolsQuery.data ?? []}
              selected={symbol}
              onSelect={setSymbol}
            />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--ko-text-muted)' }}>
              기간
            </label>
            <PeriodSelector value={interval} onChange={setInterval} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--ko-text-muted)' }}>
              차트 종류
            </label>
            <ChartToolbar value={chartType} onChange={setChartType} />
          </div>
        </div>
      </section>

      {/* 2. 지표 토글 */}
      <section style={cardStyle}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--ko-text-secondary)' }}>
          지표
        </h2>
        <IndicatorToggle
          value={indicators}
          onChange={setIndicators}
          params={indicatorParams}
          onParamsChange={setIndicatorParams}
        />
      </section>

      {/* 3. PatternChart — 메인 캔들 차트 */}
      <section style={cardStyle}>
        <h2 className="text-base font-semibold mb-3">
          {symbol.name} ({symbol.code}) @ {symbol.market} · {interval}
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
          <PatternChart
            ohlcv={ohlcvQ.data}
            patterns={selectedPatterns}
            indicators={indicators}
            indicatorParams={indicatorParams}
            chartType={chartType}
            patternOffset={patternOffset}
            onPatternOffsetChange={setPatternOffset}
            patternWidth={patternWidth}
            onPatternWidthChange={setPatternWidth}
          />
        )}
        {ohlcvQ.data && ohlcvQ.data.length === 0 && (
          <div className="text-sm" style={{ color: 'var(--ko-text-muted)' }}>
            데이터 없음 (ingest 가 아직 적재하지 않았습니다)
          </div>
        )}
      </section>

      {/* 4. 패턴 매칭 결과 */}
      <section style={cardStyle}>
        <h2 className="text-base font-semibold mb-3">차트 패턴 매칭</h2>
        <PatternSelector
          matches={matches}
          selectedIds={selectedPatternIds}
          onToggle={togglePattern}
        />
      </section>

      {/* 5. 미래 수익률 예측 */}
      <section style={cardStyle}>
        <h2 className="text-base font-semibold mb-3">미래 수익률 예측 (k-NN, 과거 유사 패턴)</h2>
        {predictionQ.isLoading && (
          <div className="text-sm" style={{ color: 'var(--ko-text-muted)' }}>예측 계산 중…</div>
        )}
        {predictionQ.isError && (
          <div className="text-sm" style={{ color: 'var(--ko-text-muted)' }}>
            예측 불가 — {toApiError(predictionQ.error).message}
          </div>
        )}
        {predictionForPanel && predictionForPanel.sample > 0 && (
          <PredictionPanel prediction={predictionForPanel} />
        )}
        {predictionForPanel && predictionForPanel.sample === 0 && (
          <div
            className="rounded p-4 text-sm"
            style={{
              background: 'var(--ko-surface-2)',
              border: '1px solid var(--ko-border-subtle)',
              color: 'var(--ko-text-secondary)',
            }}
          >
            유사 패턴이 발견되지 않았습니다 (히스토리 부족 또는 pgvector 인덱스 미적재).
          </div>
        )}
      </section>

      {/* 6. KpiCard 요약 (예측 sample > 0 시) */}
      {predictionForPanel && predictionForPanel.sample > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="샘플 (k)" value={predictionForPanel.sample} />
          <KpiCard
            label="평균 5d 수익률"
            value={pct(predictionQ.data!.avgReturn5d)}
            deltaTone={(predictionForPanel.avgReturn5d ?? 0) > 0 ? 'profit' : 'loss'}
          />
          <KpiCard
            label="평균 20d 수익률"
            value={pct(predictionQ.data!.avgReturn20d)}
            deltaTone={(predictionForPanel.avgReturn20d ?? 0) > 0 ? 'profit' : 'loss'}
          />
          <KpiCard
            label="평균 60d 수익률"
            value={pct(predictionQ.data!.avgReturn60d)}
            deltaTone={(predictionForPanel.avgReturn60d ?? 0) > 0 ? 'profit' : 'loss'}
          />
        </div>
      )}

      {/* 7. 유사 패턴 테이블 */}
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
