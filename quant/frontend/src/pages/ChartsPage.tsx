import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, X } from 'lucide-react'
import { KpiCard } from '@kgd/design-system'
import { apiClient, unwrap, toApiError } from '@/api/client'
import type { ApiResponse } from '@/types/api'

import {
  fetchSymbols,
  backendMarketOf,
  backendAssetOf,
  type Symbol as ChartSymbol,
  type OhlcvBar,
} from '@/charting/api'
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

function formatPrice(n: number, assetClass: ChartSymbol['assetClass']): string {
  if (!Number.isFinite(n)) return '—'
  if (assetClass === 'STOCK_KR') return `₩${n.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`
  if (assetClass === 'STOCK_US') return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  // CRYPTO — KRW
  return `₩${n.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`
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

type BottomTab = 'indicators' | 'patterns' | 'prediction' | 'similar'

const BOTTOM_TABS: Array<{ key: BottomTab; label: string }> = [
  { key: 'indicators', label: '지표' },
  { key: 'patterns', label: '패턴' },
  { key: 'prediction', label: '예측' },
  { key: 'similar', label: '유사' },
]

/**
 * ChartsPage — 모바일 우선 차트 분석 (빗썸 모바일 패턴 벤치마크).
 *
 * 모바일 (< md):
 *   - sticky 가격 헤더 (종목 + 현재가 + 변동률) — 탭 시 종목 sheet 오픈
 *   - 시간프레임 가로 스크롤 칩
 *   - 풀폭 차트
 *   - 하단 탭 (지표 / 패턴 / 예측 / 유사) — 가로 스크롤
 *
 * 데스크탑 (≥ md):
 *   - 좌측 종목 패널 + 우측 차트 영역 (sticky 헤더 유지)
 *   - 데이터 패널을 단일 column 으로 stacking
 */
export function ChartsPage() {
  const [symbol, setSymbol] = useState<ChartSymbol>({
    id: 1,
    ticker: 'BTC',
    name: '비트코인',
    market: 'CRYPTO',
    assetClass: 'CRYPTO',
    active: true,
  })
  const [interval, setInterval] = useState('1d')
  const [chartType, setChartType] = useState<ChartType>('candle')
  const [indicators, setIndicators] = useState<Indicators>(DEFAULT_INDICATORS)
  const [indicatorParams, setIndicatorParams] = useState<IndicatorParams>(DEFAULT_PARAMS)
  const [selectedPatternIds, setSelectedPatternIds] = useState<Set<string>>(new Set())
  const [patternOffset, setPatternOffset] = useState<number | null>(null)
  const [patternWidth, setPatternWidth] = useState<number>(60)
  const [bottomTab, setBottomTab] = useState<BottomTab>('patterns')
  const [symbolSheetOpen, setSymbolSheetOpen] = useState(false)

  const backendMarket = backendMarketOf(symbol.assetClass)
  const backendAsset = backendAssetOf(symbol.ticker, symbol.assetClass)

  const { from, to } = useMemo(() => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const monthAgo = new Date(today.getTime() - 30 * 86400_000)
    return { from: monthAgo.toISOString(), to: today.toISOString() }
  }, [])

  const ohlcvQ = useQuery({
    queryKey: ['ohlcv', symbol.ticker, backendMarket, interval, from, to],
    queryFn: async (): Promise<OhlcvBar[]> => {
      const qs = new URLSearchParams({
        asset: backendAsset,
        market: backendMarket,
        interval,
        from,
        to,
      }).toString()
      const res = await apiClient.get<
        ApiResponse<Array<{ ts: string; open: string | number; high: string | number; low: string | number; close: string | number; volume: string | number }>>
      >(`/api/v1/charts/ohlcv?${qs}`)
      const data = unwrap(res)
      return data.map((b) => {
        const [date, timepart] = (b.ts || '').split('T')
        return {
          trade_date: date,
          bar_time: timepart && !timepart.startsWith('00:00:00') ? timepart.slice(0, 8) : null,
          open: Number(b.open),
          high: Number(b.high),
          low: Number(b.low),
          close: Number(b.close),
          volume: Number(b.volume),
        } satisfies OhlcvBar
      })
    },
  })

  // 가격 요약 — 마지막 close + 첫 close 대비 변동률
  const priceSummary = useMemo(() => {
    const bars = ohlcvQ.data
    if (!bars || bars.length === 0) return null
    const first = bars[0].close
    const last = bars[bars.length - 1].close
    const change = last - first
    const changePct = first > 0 ? (change / first) * 100 : 0
    return { last, change, changePct, isUp: change >= 0 }
  }, [ohlcvQ.data])

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

  const predictionQ = useQuery({
    queryKey: ['prediction', symbol.ticker, backendMarket],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Prediction>>(
        `/api/v1/charts/prediction?asset=${backendAsset}&market=${backendMarket}&windowDays=60&k=50`,
      )
      return unwrap(res)
    },
    retry: false,
  })

  const similarityQ = useQuery({
    queryKey: ['similarity-search', symbol.ticker, backendMarket, to],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SimilarityHit[]>>(
        `/api/v1/charts/similarity/search?asset=${backendAsset}&market=${backendMarket}&windowEnd=${to}&windowDays=60&k=20`,
      )
      return unwrap(res)
    },
    retry: false,
  })

  const onPickSymbol = (s: ChartSymbol) => {
    setSymbol(s)
    setSymbolSheetOpen(false)
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--ko-surface-0)', color: 'var(--ko-text-primary)' }}
    >
      {/* === Sticky 가격 헤더 — 종목명 + 현재가 + 변동률 === */}
      <header
        className="sticky top-0 z-20 backdrop-blur-md"
        style={{
          background: 'color-mix(in oklch, var(--ko-surface-0) 85%, transparent)',
          borderBottom: '1px solid var(--ko-border-subtle)',
        }}
      >
        <div className="px-4 md:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setSymbolSheetOpen(true)}
            className="flex items-center gap-2 active:scale-[0.98] transition-transform"
          >
            <div className="text-left">
              <div className="text-base md:text-lg font-bold leading-tight">
                {symbol.name}
              </div>
              <div className="text-[11px] md:text-xs leading-tight" style={{ color: 'var(--ko-text-muted)' }}>
                {symbol.ticker} · {assetLabel(symbol.assetClass)}
              </div>
            </div>
            <ChevronDown className="w-4 h-4" style={{ color: 'var(--ko-text-muted)' }} />
          </button>

          <div className="flex-1" />

          {priceSummary && (
            <div className="text-right">
              <div
                className="text-base md:text-xl font-bold tabular-nums leading-tight"
                style={{
                  color: priceSummary.isUp
                    ? 'var(--ko-status-profit)'
                    : 'var(--ko-status-loss)',
                }}
              >
                {formatPrice(priceSummary.last, symbol.assetClass)}
              </div>
              <div
                className="text-[11px] md:text-xs tabular-nums leading-tight"
                style={{
                  color: priceSummary.isUp
                    ? 'var(--ko-status-profit)'
                    : 'var(--ko-status-loss)',
                }}
              >
                {priceSummary.isUp ? '▲' : '▼'} {Math.abs(priceSummary.changePct).toFixed(2)}%
                <span className="ml-1.5" style={{ color: 'var(--ko-text-muted)' }}>
                  ({priceSummary.change >= 0 ? '+' : ''}
                  {formatPrice(priceSummary.change, symbol.assetClass)})
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 시간프레임 + 차트 종류 — 가로 스크롤 */}
        <div className="px-4 md:px-6 pb-2.5 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <PeriodSelector value={interval} onChange={setInterval} />
          <div className="shrink-0 ml-auto">
            <ChartToolbar
              chartType={chartType}
              onChartTypeChange={setChartType}
              onFullscreen={() => {
                document.querySelector('.ko-pattern-chart-wrapper')?.requestFullscreen?.()
              }}
            />
          </div>
        </div>
      </header>

      {/* === 메인 차트 === */}
      <section className="px-2 md:px-6 py-3">
        {ohlcvQ.isLoading && (
          <div className="text-sm py-12 text-center" style={{ color: 'var(--ko-text-muted)' }}>
            로딩 중…
          </div>
        )}
        {ohlcvQ.isError && (
          <div className="text-sm py-12 text-center" style={{ color: 'var(--ko-status-loss)' }}>
            에러: {toApiError(ohlcvQ.error).message}
          </div>
        )}
        {ohlcvQ.data && ohlcvQ.data.length === 0 && (
          <div
            className="text-sm py-12 text-center rounded-2xl"
            style={{
              color: 'var(--ko-text-muted)',
              background: 'var(--ko-surface-1)',
              border: '1px solid var(--ko-border-subtle)',
            }}
          >
            데이터 없음 — ingest 가 아직 적재하지 않았습니다.
            <br />
            <span className="text-xs">
              ({symbol.ticker} @ {backendMarket})
            </span>
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
      </section>

      {/* === 하단 탭 — 지표 / 패턴 / 예측 / 유사 === */}
      <section className="px-4 md:px-6 mt-1">
        <div
          className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1 sticky top-[calc(var(--ko-chart-header-h,140px))]"
        >
          {BOTTOM_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setBottomTab(t.key)}
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                bottomTab === t.key
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.label}
              {t.key === 'patterns' && matches.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  {matches.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* === 탭 콘텐츠 === */}
      <section className="px-4 md:px-6 py-3 space-y-3 flex-1">
        {bottomTab === 'indicators' && (
          <Card>
            <IndicatorToggle
              value={indicators}
              onChange={setIndicators}
              params={indicatorParams}
              onParamsChange={setIndicatorParams}
            />
          </Card>
        )}

        {bottomTab === 'patterns' && (
          <Card>
            {matches.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--ko-text-muted)' }}>
                인식된 패턴이 없습니다 (히스토리가 충분한 시점을 선택하세요).
              </p>
            ) : (
              <PatternSelector
                matches={matches}
                selectedIds={selectedPatternIds}
                onToggle={togglePattern}
              />
            )}
          </Card>
        )}

        {bottomTab === 'prediction' && (
          <div className="space-y-3">
            {predictionQ.isLoading && (
              <Card>
                <p className="text-sm py-4 text-center" style={{ color: 'var(--ko-text-muted)' }}>
                  예측 계산 중…
                </p>
              </Card>
            )}
            {predictionQ.isError && (
              <Card>
                <p className="text-sm py-4 text-center" style={{ color: 'var(--ko-text-muted)' }}>
                  예측 불가 — {toApiError(predictionQ.error).message}
                </p>
              </Card>
            )}
            {matches.length > 0 && (
              <PredictionPanel matches={matches} ticker={symbol.ticker} />
            )}
            {predictionQ.data && predictionQ.data.sample > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <KpiCard label="샘플 (k)" value={predictionQ.data.sample} />
                <KpiCard
                  label="5d"
                  value={pct(predictionQ.data.avgReturn5d)}
                  deltaTone={parseFloat(predictionQ.data.avgReturn5d ?? '0') > 0 ? 'profit' : 'loss'}
                />
                <KpiCard
                  label="20d"
                  value={pct(predictionQ.data.avgReturn20d)}
                  deltaTone={parseFloat(predictionQ.data.avgReturn20d ?? '0') > 0 ? 'profit' : 'loss'}
                />
                <KpiCard
                  label="60d"
                  value={pct(predictionQ.data.avgReturn60d)}
                  deltaTone={parseFloat(predictionQ.data.avgReturn60d ?? '0') > 0 ? 'profit' : 'loss'}
                />
              </div>
            )}
            {predictionQ.data && predictionQ.data.sample === 0 && (
              <Card>
                <p className="text-sm py-4 text-center" style={{ color: 'var(--ko-text-muted)' }}>
                  유사 패턴이 발견되지 않았습니다 (히스토리 부족 또는 pgvector 인덱스 미적재).
                </p>
              </Card>
            )}
          </div>
        )}

        {bottomTab === 'similar' && (
          <Card>
            {similarityQ.isLoading && (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--ko-text-muted)' }}>
                유사 구간 검색 중…
              </p>
            )}
            {similarityQ.isError && (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--ko-text-muted)' }}>
                유사도 검색 불가 — {toApiError(similarityQ.error).message}
              </p>
            )}
            {similarityQ.data && similarityQ.data.length === 0 && (
              <p className="text-sm py-4 text-center" style={{ color: 'var(--ko-text-muted)' }}>
                유사 패턴 없음 — pgvector 인덱스 부족.
              </p>
            )}
            {similarityQ.data && similarityQ.data.length > 0 && (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="text-left text-xs uppercase tracking-wide"
                      style={{
                        color: 'var(--ko-text-muted)',
                        borderBottom: '1px solid var(--ko-border-subtle)',
                      }}
                    >
                      <th className="py-2 px-2">자산</th>
                      <th className="py-2 px-2 hidden sm:table-cell">거래소</th>
                      <th className="py-2 px-2 hidden md:table-cell">윈도우 종료</th>
                      <th className="py-2 px-2 text-right">유사도</th>
                      <th className="py-2 px-2 text-right">5d</th>
                      <th className="py-2 px-2 text-right">20d</th>
                    </tr>
                  </thead>
                  <tbody>
                    {similarityQ.data.map((hit, i) => (
                      <tr
                        key={`${hit.assetCode}-${hit.tsWindowEnd}-${i}`}
                        style={{ borderBottom: '1px solid var(--ko-border-subtle)' }}
                      >
                        <td className="py-2 px-2 font-medium">{hit.assetCode}</td>
                        <td className="py-2 px-2 hidden sm:table-cell" style={{ color: 'var(--ko-text-secondary)' }}>
                          {hit.marketCode}
                        </td>
                        <td className="py-2 px-2 hidden md:table-cell tabular-nums text-xs" style={{ color: 'var(--ko-text-secondary)' }}>
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
          </Card>
        )}
      </section>

      {/* === 종목 선택 시트 === */}
      {symbolSheetOpen && (
        <SymbolSheet onClose={() => setSymbolSheetOpen(false)}>
          <SymbolSearch onSelect={onPickSymbol} selectedTicker={symbol.ticker} />
        </SymbolSheet>
      )}
    </div>
  )
}

function assetLabel(a: ChartSymbol['assetClass']): string {
  return a === 'CRYPTO' ? '코인' : a === 'STOCK_KR' ? '국내주식' : '미국주식'
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--ko-surface-1)',
        border: '1px solid var(--ko-border-subtle)',
        borderRadius: 'var(--ko-radius-lg)',
        padding: 'var(--ko-space-4)',
      }}
    >
      {children}
    </div>
  )
}

function SymbolSheet({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl p-4 max-h-[85vh] overflow-y-auto md:inset-y-0 md:right-auto md:left-0 md:rounded-r-2xl md:rounded-tl-none md:max-w-md md:max-h-none"
        style={{
          background: 'var(--ko-surface-1)',
          border: '1px solid var(--ko-border-subtle)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">종목 선택</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}
