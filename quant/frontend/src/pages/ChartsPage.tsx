import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { KpiCard } from '@kgd/design-system'
import { apiClient, unwrap, toApiError } from '@/api/client'
import type { ApiResponse } from '@/types/api'

import {
  backendMarketOf,
  backendAssetOf,
  type Symbol as ChartSymbol,
  type OhlcvBar,
} from '@/charting/api'
import { PatternChart } from '@/charting/components/PatternChart'
import { PatternSelector } from '@/charting/components/PatternSelector'
import { TimeframeSelector } from '@/charting/components/TimeframeSelector'
import { SymbolSearch } from '@/charting/components/SymbolSearch'
import { SymbolPickerSheet } from '@/charting/components/SymbolPickerSheet'
import { AiSideCard } from '@/charting/components/AiSideCard'
import {
  DEFAULT_PARAMS,
  type Indicators,
  type IndicatorParams,
} from '@/charting/components/IndicatorToggle'
import { ChartToolbar } from '@/charting/components/ChartToolbar'
import { PredictionPanel } from '@/charting/components/PredictionPanel'
import { StickyStockHeader } from '@/charting/components/StickyStockHeader'
import {
  MicrocontextRail,
  RangePositionBar,
  type MicrocontextChip,
} from '@/charting/components/MicrocontextRail'
import type { ChartType, TimeframeKey } from '@/charting/types'
import { matchPatterns } from '@/charting/lib/patternMatcher'
import { PATTERNS as ALL_PATTERNS } from '@/charting/lib/patterns'
import { calcMA, calcRSI, calcATR } from '@/charting/lib/indicators'
import { useFundamentals } from '@/charting/hooks/useFundamentals'

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

/** 거래대금: KR 자산 = 조/억/만원, US = $compact. */
function formatCompactKrw(n: number, assetClass: ChartSymbol['assetClass']): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (assetClass === 'STOCK_US') {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`
    return `$${n.toFixed(0)}`
  }
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}조원`
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}억원`
  if (n >= 1e4) return `${(n / 1e4).toFixed(0)}만원`
  return `${Math.round(n).toLocaleString('ko-KR')}원`
}

/** 거래량 (단위 없음): B/M/K. */
function formatCompactCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—'
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return Math.round(n).toLocaleString()
}

/** AI 한 줄 요약 — RSI/MA20/변동률 임계로 단문 생성 (P2 에서 LLM 으로 격상 검토). */
function aiSummaryText(bars: OhlcvBar[], chips: MicrocontextChip[]): string {
  if (bars.length === 0) return ''
  const first = bars[0].close
  const last = bars[bars.length - 1].close
  const changePct = first > 0 ? ((last - first) / first) * 100 : 0
  const direction = changePct >= 0 ? '상승' : '하락'

  const rsiChip = chips.find(c => c.key === 'rsi')
  const ma20Chip = chips.find(c => c.key === 'ma20')

  const parts: string[] = []
  parts.push(`최근 ${bars.length}일 ${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}% ${direction}`)
  if (rsiChip?.secondary && rsiChip.secondary !== '중립') {
    parts.push(`RSI ${rsiChip.value} ${rsiChip.secondary}`)
  }
  if (ma20Chip?.secondary) {
    parts.push(`MA20 ${ma20Chip.secondary}`)
  }
  return parts.join(' · ')
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

/** 5-tab system (TG-5).
 *  - chart   : 패턴 매칭 + 차트 보조 정보 (default)
 *  - info    : 종목정보 (시총/PE/배당) — P2 disabled
 *  - insight : AI 인사이트 (자연어 요약 + 예측 + 유사도)
 *  - news    : 뉴스·공시 — P2 disabled
 *  - flows   : 매매주체 (외국인/기관/개인) — P2 disabled
 */
type BottomTab = 'chart' | 'info' | 'insight' | 'news' | 'flows'

const BOTTOM_TABS: Array<{
  key: BottomTab
  label: string
  disabled?: boolean
  reason?: string
}> = [
  { key: 'chart', label: '차트·정보' },
  { key: 'info', label: '종목정보' },
  { key: 'insight', label: 'AI 인사이트' },
  { key: 'news', label: '뉴스·공시', disabled: true, reason: 'P2 활성화 예정' },
  { key: 'flows', label: '매매주체', disabled: true, reason: 'P2 활성화 예정' },
]

function isBottomTab(value: string | null): value is BottomTab {
  return (
    value === 'chart' ||
    value === 'info' ||
    value === 'insight' ||
    value === 'news' ||
    value === 'flows'
  )
}

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
  const [interval, setInterval] = useState<TimeframeKey>('1d')
  const [chartType, setChartType] = useState<ChartType>('candle')
  const [indicators, setIndicators] = useState<Indicators>(DEFAULT_INDICATORS)
  const [indicatorParams, setIndicatorParams] = useState<IndicatorParams>(DEFAULT_PARAMS)
  const [selectedPatternIds, setSelectedPatternIds] = useState<Set<string>>(new Set())
  const [patternOffset, setPatternOffset] = useState<number | null>(null)
  const [patternWidth, setPatternWidth] = useState<number>(60)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const bottomTab: BottomTab = isBottomTab(tabParam) ? tabParam : 'chart'
  const setBottomTab = (next: BottomTab) => {
    setSearchParams(
      prev => {
        const p = new URLSearchParams(prev)
        if (next === 'chart') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )
  }
  const [symbolSheetOpen, setSymbolSheetOpen] = useState(false)
  const [compareSymbol, setCompareSymbol] = useState<ChartSymbol | null>(null)
  const [compareSheetOpen, setCompareSheetOpen] = useState(false)

  // '/' 단축키 — input/textarea/contentEditable focus 외에서 종목 검색 sheet 오픈
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/') return
      const target = e.target as HTMLElement | null
      if (!target) return
      const tag = target.tagName?.toUpperCase()
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      e.preventDefault()
      setSymbolSheetOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const backendMarket = backendMarketOf(symbol.assetClass)
  const backendAsset = backendAssetOf(symbol.ticker, symbol.assetClass)

  const { from, to } = useMemo(() => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const monthAgo = new Date(today.getTime() - 30 * 86400_000)
    return { from: monthAgo.toISOString(), to: today.toISOString() }
  }, [])

  const fetchOhlcv = async (
    asset: string,
    market: string,
  ): Promise<OhlcvBar[]> => {
    const qs = new URLSearchParams({
      asset,
      market,
      interval,
      from,
      to,
    }).toString()
    const res = await apiClient.get<
      ApiResponse<
        Array<{
          ts: string
          open: string | number
          high: string | number
          low: string | number
          close: string | number
          volume: string | number
        }>
      >
    >(`/api/v1/charts/ohlcv?${qs}`)
    const data = unwrap(res)
    return data.map(b => {
      const [date, timepart] = (b.ts || '').split('T')
      return {
        trade_date: date,
        bar_time:
          timepart && !timepart.startsWith('00:00:00')
            ? timepart.slice(0, 8)
            : null,
        open: Number(b.open),
        high: Number(b.high),
        low: Number(b.low),
        close: Number(b.close),
        volume: Number(b.volume),
      } satisfies OhlcvBar
    })
  }

  const ohlcvQ = useQuery({
    queryKey: ['ohlcv', symbol.ticker, backendMarket, interval, from, to],
    queryFn: () => fetchOhlcv(backendAsset, backendMarket),
  })

  // TG-12 — 비교 종목 OHLCV (compareSymbol 활성 시에만)
  const compareBackendMarket = compareSymbol
    ? backendMarketOf(compareSymbol.assetClass)
    : null
  const compareBackendAsset = compareSymbol
    ? backendAssetOf(compareSymbol.ticker, compareSymbol.assetClass)
    : null
  const compareOhlcvQ = useQuery({
    queryKey: [
      'ohlcv-compare',
      compareSymbol?.ticker ?? '',
      compareBackendMarket ?? '',
      interval,
      from,
      to,
    ],
    enabled: !!compareSymbol && !!compareBackendAsset && !!compareBackendMarket,
    queryFn: () => fetchOhlcv(compareBackendAsset!, compareBackendMarket!),
  })

  // TG-9 — Fundamentals (Yahoo v10 quoteSummary, 1h 캐시)
  const fundamentalsQ = useFundamentals(backendAsset, backendMarket)

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

  // Microcontext chips — TG-3 (P1 데이터 기반 7-chip)
  const microcontextChips = useMemo<MicrocontextChip[]>(() => {
    const bars = ohlcvQ.data
    if (!bars || bars.length === 0) return []
    const closes = bars.map(b => b.close)
    const highs = bars.map(b => b.high)
    const lows = bars.map(b => b.low)
    const volumes = bars.map(b => b.volume)

    const last = closes[closes.length - 1]
    const high = Math.max(...highs)
    const low = Math.min(...lows)
    const rangePos = high > low ? (last - low) / (high - low) : 0.5

    const totalVolume = volumes.reduce((a, b) => a + b, 0)
    const avgVolume = totalVolume / Math.max(volumes.length, 1)
    const totalTurnover = bars.reduce((a, b) => a + b.close * b.volume, 0)

    const finiteLast = (arr: (number | null)[]): number | null => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const v = arr[i]
        if (v != null && Number.isFinite(v)) return v
      }
      return null
    }
    const lastRsi = finiteLast(calcRSI(closes, 14))
    const lastAtr = finiteLast(calcATR(highs, lows, closes, 14))
    const lastMa20 = finiteLast(calcMA(closes, 20))
    const ma20Dev = lastMa20 != null ? ((last - lastMa20) / lastMa20) * 100 : null

    const chips: MicrocontextChip[] = [
      {
        key: 'range',
        label: '30일 범위',
        value: formatPrice(low, symbol.assetClass),
        secondary: `~ ${formatPrice(high, symbol.assetClass)}`,
        visual: <RangePositionBar position={rangePos} />,
      },
      {
        key: 'turnover',
        label: '거래대금 (30D)',
        value: formatCompactKrw(totalTurnover, symbol.assetClass),
      },
      {
        key: 'avgVol',
        label: '평균 거래량',
        value: formatCompactCount(avgVolume),
      },
      {
        key: 'rsi',
        label: 'RSI(14)',
        value: lastRsi != null ? lastRsi.toFixed(1) : '—',
        tone:
          lastRsi == null
            ? 'muted'
            : lastRsi >= 70
              ? 'rise'
              : lastRsi <= 30
                ? 'fall'
                : 'neutral',
        secondary:
          lastRsi == null
            ? undefined
            : lastRsi >= 70
              ? '과매수'
              : lastRsi <= 30
                ? '과매도'
                : '중립',
      },
      {
        key: 'atr',
        label: 'ATR(14)',
        value: lastAtr != null ? lastAtr.toFixed(2) : '—',
        secondary: '변동성',
      },
      {
        key: 'ma20',
        label: 'MA20',
        value: lastMa20 != null ? formatPrice(lastMa20, symbol.assetClass) : '—',
        secondary:
          ma20Dev != null
            ? `${ma20Dev >= 0 ? '+' : ''}${ma20Dev.toFixed(1)}%`
            : undefined,
        tone:
          ma20Dev == null ? 'muted' : ma20Dev >= 0 ? 'rise' : 'fall',
      },
      {
        key: 'change',
        label: '기간 수익률',
        value: priceSummary
          ? `${priceSummary.isUp ? '+' : ''}${priceSummary.changePct.toFixed(2)}%`
          : '—',
        tone: priceSummary == null ? 'muted' : priceSummary.isUp ? 'rise' : 'fall',
        secondary: priceSummary
          ? `${priceSummary.change >= 0 ? '+' : ''}${formatPrice(priceSummary.change, symbol.assetClass)}`
          : undefined,
      },
    ]
    return chips
  }, [ohlcvQ.data, symbol.assetClass, priceSummary])

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
      {/* === Sticky 종목 헤더 — 종목명/큰 가격/변동률 + microcontext + 시간프레임/도구바 === */}
      <StickyStockHeader
        symbol={symbol}
        priceSummary={priceSummary}
        formatPrice={n => formatPrice(n, symbol.assetClass)}
        onSymbolClick={() => setSymbolSheetOpen(true)}
        microcontext={
          <div className="space-y-2">
            <MicrocontextRail chips={microcontextChips} />
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <TimeframeSelector value={interval} onChange={setInterval} />
              <div className="shrink-0 ml-auto">
                <ChartToolbar
                  chartType={chartType}
                  onChartTypeChange={setChartType}
                  onFullscreen={() => {
                    document
                      .querySelector('.ko-pattern-chart-wrapper')
                      ?.requestFullscreen?.()
                  }}
                  indicators={indicators}
                  onIndicatorsChange={setIndicators}
                  indicatorParams={indicatorParams}
                  onIndicatorParamsChange={setIndicatorParams}
                  compareLabel={compareSymbol?.name ?? null}
                  onCompareClick={() => setCompareSheetOpen(true)}
                  onCompareClear={() => setCompareSymbol(null)}
                />
              </div>
            </div>
          </div>
        }
      />

      <div className="flex-1 lg:max-w-screen-2xl lg:mx-auto lg:w-full lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-4">
        <main className="lg:min-w-0">
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
            compareBars={
              compareOhlcvQ.data && compareOhlcvQ.data.length > 0
                ? compareOhlcvQ.data
                : undefined
            }
            compareLabel={compareSymbol?.name}
          />
        )}
      </section>

      {/* === 하단 탭 — 차트·정보 / 종목정보 / AI 인사이트 / 뉴스 / 매매주체 === */}
      <section className="px-4 md:px-6 mt-1">
        <div
          role="tablist"
          aria-label="콘텐츠 탭"
          className="flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1 sticky top-[calc(var(--ko-chart-header-h,140px))]"
        >
          {BOTTOM_TABS.map(t => {
            const active = bottomTab === t.key
            const dis = !!t.disabled
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                aria-disabled={dis || undefined}
                disabled={dis}
                title={dis ? t.reason : t.label}
                onClick={() => setBottomTab(t.key)}
                className="shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{
                  background: active
                    ? 'color-mix(in oklch, var(--ko-accent-primary) 22%, transparent)'
                    : 'transparent',
                  border: active
                    ? '1px solid color-mix(in oklch, var(--ko-accent-primary) 40%, transparent)'
                    : '1px solid transparent',
                  color: dis
                    ? 'var(--ko-text-disabled)'
                    : active
                      ? 'var(--ko-accent-primary-hover)'
                      : 'var(--ko-text-muted)',
                  opacity: dis ? 0.6 : 1,
                  cursor: dis ? 'not-allowed' : 'pointer',
                }}
              >
                {t.label}
                {t.key === 'chart' && matches.length > 0 && (
                  <span
                    className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded tabular-nums"
                    style={{
                      background:
                        'color-mix(in oklch, var(--ko-accent-primary) 30%, transparent)',
                      color: 'var(--ko-accent-primary-hover)',
                    }}
                  >
                    {matches.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* === 탭 콘텐츠 === */}
      <section className="px-4 md:px-6 py-3 space-y-3 flex-1">
        {bottomTab === 'chart' && (
          <Card>
            {matches.length === 0 ? (
              <p
                className="text-sm py-6 text-center"
                style={{ color: 'var(--ko-text-muted)' }}
              >
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

        {bottomTab === 'info' && (
          <Card>
            <StockInfoSection
              fundamentals={fundamentalsQ.data ?? null}
              loading={fundamentalsQ.isLoading}
              error={fundamentalsQ.isError}
              assetClass={symbol.assetClass}
            />
          </Card>
        )}

        {bottomTab === 'insight' && (
          <div className="space-y-3">
            {/* 자연어 요약 카드 */}
            {ohlcvQ.data && ohlcvQ.data.length > 0 && (
              <Card>
                <div className="flex items-start gap-3">
                  <div
                    className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-base"
                    style={{
                      background:
                        'color-mix(in oklch, var(--ko-accent-primary) 18%, transparent)',
                      color: 'var(--ko-accent-primary-hover)',
                    }}
                    aria-hidden="true"
                  >
                    AI
                  </div>
                  <div className="flex-1">
                    <div
                      className="text-[10px] uppercase tracking-wide"
                      style={{ color: 'var(--ko-text-muted)' }}
                    >
                      한 줄 요약
                    </div>
                    <div
                      className="text-sm mt-0.5"
                      style={{ color: 'var(--ko-text-primary)' }}
                    >
                      {aiSummaryText(ohlcvQ.data, microcontextChips)}
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {predictionQ.isLoading && (
              <Card>
                <p
                  className="text-sm py-4 text-center"
                  style={{ color: 'var(--ko-text-muted)' }}
                >
                  예측 계산 중…
                </p>
              </Card>
            )}
            {predictionQ.isError && (
              <Card>
                <p
                  className="text-sm py-4 text-center"
                  style={{ color: 'var(--ko-text-muted)' }}
                >
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
                  deltaTone={
                    parseFloat(predictionQ.data.avgReturn5d ?? '0') > 0
                      ? 'profit'
                      : 'loss'
                  }
                />
                <KpiCard
                  label="20d"
                  value={pct(predictionQ.data.avgReturn20d)}
                  deltaTone={
                    parseFloat(predictionQ.data.avgReturn20d ?? '0') > 0
                      ? 'profit'
                      : 'loss'
                  }
                />
                <KpiCard
                  label="60d"
                  value={pct(predictionQ.data.avgReturn60d)}
                  deltaTone={
                    parseFloat(predictionQ.data.avgReturn60d ?? '0') > 0
                      ? 'profit'
                      : 'loss'
                  }
                />
              </div>
            )}
            {predictionQ.data && predictionQ.data.sample === 0 && (
              <Card>
                <p
                  className="text-sm py-4 text-center"
                  style={{ color: 'var(--ko-text-muted)' }}
                >
                  유사 패턴이 발견되지 않았습니다 (히스토리 부족 또는 pgvector
                  인덱스 미적재).
                </p>
              </Card>
            )}

            {/* Similarity 표 */}
            <Card>
              <div
                className="text-[10px] uppercase tracking-wide mb-2"
                style={{ color: 'var(--ko-text-muted)' }}
              >
                유사 자산 (pgvector)
              </div>
              {similarityQ.isLoading && (
                <p
                  className="text-sm py-4 text-center"
                  style={{ color: 'var(--ko-text-muted)' }}
                >
                  유사 구간 검색 중…
                </p>
              )}
              {similarityQ.isError && (
                <p
                  className="text-sm py-4 text-center"
                  style={{ color: 'var(--ko-text-muted)' }}
                >
                  유사도 검색 불가 — {toApiError(similarityQ.error).message}
                </p>
              )}
              {similarityQ.data && similarityQ.data.length === 0 && (
                <p
                  className="text-sm py-4 text-center"
                  style={{ color: 'var(--ko-text-muted)' }}
                >
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
          </div>
        )}

        {bottomTab === 'news' && (
          <Card>
            <DisabledTabPlaceholder
              title="뉴스·공시"
              description="실시간 뉴스 피드와 공시 자료를 P2 에서 통합할 예정입니다."
            />
          </Card>
        )}

        {bottomTab === 'flows' && (
          <Card>
            <DisabledTabPlaceholder
              title="매매주체 동향"
              description="개인·외국인·기관 순매수/매도 일별 데이터를 KRX/FDR ingest 보강 후 제공할 예정입니다."
            />
          </Card>
        )}
      </section>
        </main>

        {/* 데스크톱 (≥lg) 우측 sticky AI 사이드 카드 — TG-7 */}
        <aside className="hidden lg:block px-4 py-3">
          <div className="sticky top-[260px]">
            {ohlcvQ.data && ohlcvQ.data.length > 0 && (
              <AiSideCard
                summary={aiSummaryText(ohlcvQ.data, microcontextChips)}
                topMatch={
                  matches.length > 0
                    ? {
                        label: matches[0].pattern.name,
                        score: matches[0].score,
                        color: matches[0].pattern.color,
                      }
                    : undefined
                }
                prediction={
                  predictionQ.data
                    ? {
                        sample: predictionQ.data.sample,
                        avgReturn5d: predictionQ.data.avgReturn5d,
                        avgReturn20d: predictionQ.data.avgReturn20d,
                      }
                    : null
                }
                onSeeMore={() => setBottomTab('insight')}
              />
            )}
          </div>
        </aside>
      </div>

      {/* === 종목 선택 sheet (mobile) / dialog (desktop) — '/' 단축키 === */}
      <SymbolPickerSheet
        open={symbolSheetOpen}
        onClose={() => setSymbolSheetOpen(false)}
      >
        <SymbolSearch onSelect={onPickSymbol} selectedTicker={symbol.ticker} />
      </SymbolPickerSheet>

      {/* === 비교 종목 선택 sheet — TG-12 === */}
      <SymbolPickerSheet
        open={compareSheetOpen}
        onClose={() => setCompareSheetOpen(false)}
        title="비교 종목 선택"
      >
        <SymbolSearch
          onSelect={s => {
            setCompareSymbol(s)
            setCompareSheetOpen(false)
          }}
          selectedTicker={compareSymbol?.ticker ?? ''}
        />
      </SymbolPickerSheet>
    </div>
  )
}

/** 종목정보 탭 콘텐츠 — fundamentals 카드 그리드. TG-9 활성화. */
function StockInfoSection({
  fundamentals,
  loading,
  error,
  assetClass,
}: {
  fundamentals: import('@/charting/hooks/useFundamentals').Fundamentals | null
  loading: boolean
  error: boolean
  assetClass: ChartSymbol['assetClass']
}) {
  if (loading) {
    return (
      <p
        className="text-sm py-6 text-center"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        종목 정보 불러오는 중…
      </p>
    )
  }
  if (error || !fundamentals) {
    return (
      <DisabledTabPlaceholder
        title="종목정보 없음"
        description="이 자산은 fundamentals 데이터가 제공되지 않거나 (CRYPTO 등), 외부 source 가 응답하지 않습니다."
      />
    )
  }

  const f = fundamentals
  const items: Array<{ label: string; value: string; secondary?: string }> = [
    {
      label: '시가총액',
      value: formatCompactKrw(parseNum(f.marketCap), assetClass),
    },
    {
      label: 'PER (TTM)',
      value: formatRatio(f.peRatio),
    },
    {
      label: 'EPS (TTM)',
      value: formatRatio(f.eps),
    },
    {
      label: '배당수익률',
      value: formatPct(f.dividendYield),
    },
    {
      label: '베타',
      value: formatRatio(f.beta),
    },
    {
      label: '52주 최고',
      value: f.weeks52High != null ? formatRatio(f.weeks52High) : '—',
    },
    {
      label: '52주 최저',
      value: f.weeks52Low != null ? formatRatio(f.weeks52Low) : '—',
    },
    {
      label: '평균 거래량 (3M)',
      value: formatCompactCount(parseNum(f.avgDailyVolume)),
    },
  ]

  return (
    <div>
      <div
        className="text-[10px] uppercase tracking-wide mb-2"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        Yahoo Finance · {new Date(f.asOf).toLocaleString('ko-KR')}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {items.map(it => (
          <div
            key={it.label}
            className="rounded-lg p-2.5"
            style={{
              background: 'var(--ko-surface-2)',
              border: '1px solid var(--ko-border-subtle)',
            }}
          >
            <div
              className="text-[10px] uppercase tracking-wide"
              style={{ color: 'var(--ko-text-muted)' }}
            >
              {it.label}
            </div>
            <div
              className="mt-0.5 text-sm font-semibold tabular-nums"
              style={{ color: 'var(--ko-text-primary)' }}
            >
              {it.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function parseNum(s: string | null | undefined): number {
  if (s == null) return NaN
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : NaN
}

function formatRatio(s: string | null | undefined): string {
  const n = parseNum(s)
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return n.toFixed(2)
}

function formatPct(s: string | null | undefined): string {
  const n = parseNum(s)
  if (!Number.isFinite(n)) return '—'
  return `${(n * 100).toFixed(2)}%`
}

function DisabledTabPlaceholder({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="py-10 text-center space-y-2">
      <div
        className="text-base font-semibold"
        style={{ color: 'var(--ko-text-secondary)' }}
      >
        {title}
      </div>
      <div
        className="text-sm max-w-md mx-auto"
        style={{ color: 'var(--ko-text-muted)' }}
      >
        {description}
      </div>
      <div
        className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded-full"
        style={{
          background: 'color-mix(in oklch, var(--ko-status-warning) 18%, transparent)',
          color: 'var(--ko-status-warning)',
        }}
      >
        Phase 2 활성화 예정
      </div>
    </div>
  )
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

