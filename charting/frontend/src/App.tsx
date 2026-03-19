// charting/frontend/src/App.tsx
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LineChart } from 'lucide-react'
import { SymbolSearch } from './components/SymbolSearch'
import { IndicatorToggle, type Indicators } from './components/IndicatorToggle'
import { PatternSelector } from './components/PatternSelector'
import { PatternChart } from './components/PatternChart'
import { PredictionPanel } from './components/PredictionPanel'
import { fetchOhlcv, syncTicker, type Symbol, type OhlcvBar } from './api'
import { PATTERNS } from './lib/patterns'
import { matchPatterns, type PatternMatch } from './lib/patternMatcher'
import { BarChart3, Layers, Settings } from 'lucide-react'
import { PeriodSelector, type Period } from './components/PeriodSelector'
import { ChartToolbar } from './components/ChartToolbar'
import { aggregateWeekly, aggregateMonthly, filterRecent } from './lib/aggregation'

const DEFAULT_INDICATORS: Indicators = {
  ma5: true, ma20: true, ma60: false, ma120: false,
  bb: false, volume: true, rsi: false, macd: false,
}

export type ChartType = 'candle' | 'line' | 'area'

const EMPTY_BARS: OhlcvBar[] = []

export default function App() {
  const [ticker, setTicker] = useState('')
  const [symbolName, setSymbolName] = useState('')
  const [symbolMarket, setSymbolMarket] = useState<'US' | 'KR'>('US')
  const [indicators, setIndicators] = useState<Indicators>(DEFAULT_INDICATORS)
  const [patternMatches, setPatternMatches] = useState<PatternMatch[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [patternOffset, setPatternOffset] = useState<number | null>(null) // null = auto
  const [patternWidth, setPatternWidth] = useState(60)
  const [chartType, setChartType] = useState<ChartType>('candle')
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'stocks' | 'patterns' | 'indicators'>('stocks')
  const [period, setPeriod] = useState<Period>('3M')
  const queryClient = useQueryClient()

  const { data: ohlcv = EMPTY_BARS, isLoading } = useQuery({
    queryKey: ['ohlcv', ticker],
    queryFn: () => fetchOhlcv(ticker),
    enabled: !!ticker,
  })

  const { data: intradayBars = EMPTY_BARS } = useQuery({
    queryKey: ['ohlcv', ticker, '5m'],
    queryFn: () => fetchOhlcv(ticker, '5m'),
    enabled: !!ticker && period === '1D',
  })

  const displayBars = useMemo(() => {
    switch (period) {
      case '1D': return intradayBars
      case '1W': return filterRecent(ohlcv, 7)
      case '1M': return filterRecent(ohlcv, 30)
      case '3M': return filterRecent(ohlcv, 90)
      case '1Y': return aggregateWeekly(filterRecent(ohlcv, 365))
      case '5Y': return aggregateMonthly(ohlcv)
    }
  }, [period, ohlcv, intradayBars])

  useEffect(() => {
    setPatternMatches([])
    setSelectedIds(new Set())
    setPatternOffset(null)
    setPatternWidth(60)
  }, [period])

  // Auto-sync on ticker change
  useEffect(() => {
    if (!ticker) return
    let cancelled = false
    setSyncing(true)
    setSyncStatus('동기화 확인 중…')
    syncTicker(ticker)
      .then((res) => {
        if (cancelled) return
        if (res.synced) {
          setSyncStatus(`${res.bars_ingested}건 동기화 완료`)
          queryClient.invalidateQueries({ queryKey: ['ohlcv', ticker] })
        } else {
          setSyncStatus('최신 상태')
        }
      })
      .catch(() => { if (!cancelled) setSyncStatus('동기화 실패') })
      .finally(() => { if (!cancelled) setSyncing(false) })
    return () => { cancelled = true }
  }, [ticker])

  const handleForceSync = useCallback(() => {
    if (!ticker || syncing) return
    setSyncing(true)
    setSyncStatus('강제 동기화 중…')
    syncTicker(ticker, true)
      .then((res) => {
        if (res.synced) {
          setSyncStatus(`${res.bars_ingested}건 동기화 완료`)
          queryClient.invalidateQueries({ queryKey: ['ohlcv', ticker] })
        } else {
          setSyncStatus('변경 없음')
        }
      })
      .catch(() => setSyncStatus('동기화 실패'))
      .finally(() => setSyncing(false))
  }, [ticker, syncing, queryClient])

  const handleFullscreen = useCallback(() => {
    const el = chartContainerRef.current
    if (!el) return
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      el.requestFullscreen()
    }
  }, [])

  // Auto-compute pattern matches when display data changes
  useEffect(() => {
    if (displayBars.length >= 20) {
      const closes = displayBars.map(b => Number(b.close))
      const matches = matchPatterns(closes, PATTERNS, Math.min(60, displayBars.length))
      setPatternMatches(matches)
      setSelectedIds(new Set(matches[0] ? [matches[0].pattern.id] : []))
    } else {
      setPatternMatches([])
      setSelectedIds(new Set())
    }
  }, [displayBars])

  const handleTogglePattern = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectSymbol = useCallback((symbol: Symbol) => {
    setTicker(symbol.ticker)
    setSymbolName(symbol.name)
    setSymbolMarket(symbol.market)
    setActiveTab('patterns')
  }, [])

  const selectedMatches = useMemo(
    () => patternMatches.filter(m => selectedIds.has(m.pattern.id)),
    [patternMatches, selectedIds],
  )

  const selectedPatterns = useMemo(
    () => selectedMatches.map(m => m.pattern),
    [selectedMatches],
  )

  // Price info from OHLCV
  const lastPrice = displayBars.length > 0 ? Number(displayBars[displayBars.length - 1].close) : 0
  const firstPrice = displayBars.length > 0 ? Number(displayBars[0].close) : 0
  const priceChange = lastPrice - firstPrice
  const priceChangePercent = firstPrice !== 0 ? ((priceChange / firstPrice) * 100).toFixed(2) : '0.00'
  const isPositive = priceChange >= 0

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
              <LineChart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">PatternLens</h1>
              <p className="text-[10px] text-slate-500 -mt-0.5">차트 패턴 오버레이 &amp; 추세 예측</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {ticker && syncStatus && (
              <span className="text-slate-400 hidden sm:inline">{syncStatus}</span>
            )}
            {ticker && (
              <button
                onClick={handleForceSync}
                disabled={syncing}
                className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-xs font-medium"
              >
                {syncing ? '동기화 중…' : '동기화'}
              </button>
            )}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">실시간 시뮬레이션</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          {/* Sidebar */}
          <div className="w-full lg:w-80 shrink-0">
            {/* Mobile tabs */}
            <div className="flex lg:hidden gap-2 mb-4">
              <button
                onClick={() => setActiveTab('stocks')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'stocks'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'bg-slate-800/30 text-slate-500 border border-slate-800'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                종목
              </button>
              <button
                onClick={() => setActiveTab('patterns')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'patterns'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'bg-slate-800/30 text-slate-500 border border-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                패턴
              </button>
              <button
                onClick={() => setActiveTab('indicators')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'indicators'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'bg-slate-800/30 text-slate-500 border border-slate-800'
                }`}
              >
                <Settings className="w-4 h-4" />
                지표
              </button>
            </div>

            <div className="space-y-4">
              {/* Stock Search */}
              <div className={`${activeTab !== 'stocks' ? 'hidden lg:block' : ''}`}>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    종목 선택
                  </h2>
                  <SymbolSearch onSelect={handleSelectSymbol} selectedTicker={ticker} />
                </div>
              </div>

              {/* Pattern Selector */}
              <div className={`${activeTab !== 'patterns' ? 'hidden lg:block' : ''}`}>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    패턴 오버레이
                    {selectedIds.size > 0 && (
                      <span className="text-xs text-slate-500 font-normal">({selectedIds.size}개 선택)</span>
                    )}
                  </h2>
                  <PatternSelector
                    matches={patternMatches}
                    selectedIds={selectedIds}
                    onToggle={handleTogglePattern}
                  />
                </div>
              </div>

              {/* Indicator Toggle */}
              <div className={`${activeTab !== 'indicators' ? 'hidden lg:block' : ''}`}>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-amber-400" />
                    보조지표
                  </h2>
                  <IndicatorToggle value={indicators} onChange={setIndicators} />
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0 space-y-4 sm:space-y-6">
            {/* Chart Header */}
            {ticker && ohlcv.length > 0 && (
              <div className="flex items-end justify-between px-1">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                      {symbolMarket === 'KR' ? symbolName : ticker}
                    </h2>
                    <span className="text-sm text-slate-500">
                      {symbolMarket === 'KR' ? ticker.replace('.KS', '').replace('.KQ', '') : symbolName}
                    </span>
                    {isLoading && <span className="text-xs text-slate-500">로딩 중…</span>}
                  </div>
                  <div className="flex items-baseline gap-3 mt-1">
                    <span className="text-3xl font-bold text-white">
                      {symbolMarket === 'KR' ? `₩${lastPrice.toLocaleString()}` : `$${lastPrice.toFixed(2)}`}
                    </span>
                    <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? '+' : ''}{priceChange.toFixed(2)} ({isPositive ? '+' : ''}{priceChangePercent}%)
                    </span>
                  </div>
                </div>
                {selectedPatterns.length > 0 && (
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    selectedPatterns[0].signal === 'bullish'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : selectedPatterns[0].signal === 'bearish'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {selectedPatterns[0].name} 오버레이 중
                  </div>
                )}
              </div>
            )}

            {ticker && (
              <div className="flex items-center justify-between px-1">
                <PeriodSelector value={period} onChange={setPeriod} />
                <ChartToolbar
                  chartType={chartType}
                  onChartTypeChange={setChartType}
                  onFullscreen={handleFullscreen}
                />
              </div>
            )}

            {/* Chart */}
            <div
              ref={chartContainerRef}
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6 fullscreen:bg-slate-950 fullscreen:p-2 overflow-visible"
              style={{ minHeight: 350 }}
            >
              <PatternChart
                ohlcv={displayBars}
                patterns={selectedPatterns}
                indicators={indicators}
                chartType={chartType}
                patternOffset={patternOffset}
                onPatternOffsetChange={setPatternOffset}
                patternWidth={patternWidth}
                onPatternWidthChange={setPatternWidth}
              />
            </div>

            {/* Prediction Panel */}
            {selectedMatches.length > 0 && ticker && (
              <PredictionPanel matches={selectedMatches} ticker={ticker} />
            )}

            {/* Legend */}
            {ticker && ohlcv.length > 0 && (
              <div className="flex flex-wrap gap-4 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-0.5 bg-emerald-500 rounded" />
                  <span className="text-xs text-slate-500">실제 주가</span>
                </div>
                {selectedPatterns.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className="w-6 h-0.5 rounded" style={{ borderTop: `2px dashed ${p.color}` }} />
                    <span className="text-xs text-slate-500">{p.name} 패턴</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
