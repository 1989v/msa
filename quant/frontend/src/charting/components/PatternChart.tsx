// charting/components/PatternChart.tsx
//
// ChartCore (v5 panes API) 위임 + indicators 동적 매핑 + PatternOverlay 합성.
// TG-2-C 재설계 (이전: 840줄 8 createChart 인스턴스). 단일 chart + multi-pane.
//
// 시간 변환은 PatternChart 가 직접 prepareBars 로 결정 (KR intraday timezone 안전).
// 그 toTime fn 을 ChartCore + PatternOverlay 양쪽에 일관 전달.
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts'
import { ChartCore, type ChartClickInfo, type ChartCrosshairInfo, type ChartIndicatorSeries } from './ChartCore'
import { PatternOverlay } from './PatternOverlay'
import { DrawingOverlay } from './DrawingOverlay'
import type { Drawing } from '../lib/drawing'
import type { OhlcvBar } from '../api'
import type { PatternDefinition } from '../lib/patterns'
import type { Indicators, IndicatorParams } from './IndicatorToggle'
import type { ChartType } from '../types'
import {
  calcMA,
  calcBollingerBands,
  calcRSI,
  calcMACD,
  calcStochastic,
  calcWilliamsR,
  calcATR,
  calcOBV,
  calcVWAP,
} from '../lib/indicators'

interface PatternChartProps {
  ohlcv: OhlcvBar[]
  patterns: PatternDefinition[]
  indicators: Indicators
  indicatorParams?: IndicatorParams
  chartType?: ChartType
  patternOffset?: number | null
  onPatternOffsetChange?: (offset: number | null) => void
  patternWidth?: number
  onPatternWidthChange?: (width: number) => void
  /** TG-12 종목비교 — 비교 종목 OHLCV (메인과 동일 시간축). 비활성 시 undefined. */
  compareBars?: OhlcvBar[]
  compareLabel?: string
  compareColor?: string
  /** TG-11 그리기 — 사용자 가로선 등. */
  drawings?: Drawing[]
  formatPrice?: (n: number) => string
  /** TG-11 그리기 — chart click (drawing mode 활성 시 두 점 클릭). */
  onChartClick?: (info: ChartClickInfo) => void
}

// ── Bar prep (KR intraday timezone safety) ────────────────────────────────
//
// Intraday bars from KR exchanges report bar_time as UTC 00:00 for KST 09:00.
// Direct UTC parse would shift the chart 9 hours back. We instead assign
// sequential 5-minute timestamps starting from midnight UTC of trade_date.
function prepareBars(bars: OhlcvBar[]): {
  data: OhlcvBar[]
  intraday: boolean
  toTime: (b: OhlcvBar, idx: number) => Time
} {
  if (bars.length < 2) {
    return {
      data: [...bars],
      intraday: false,
      toTime: b => (b.trade_date as unknown) as Time,
    }
  }
  const intraday = bars[0].trade_date === bars[1].trade_date
  if (intraday) {
    const baseDate = new Date(bars[0].trade_date + 'T00:00:00Z')
    const baseTs = Math.floor(baseDate.getTime() / 1000)
    const interval = 5 * 60
    const timeMap = new Map<OhlcvBar, number>()
    bars.forEach((b, i) => timeMap.set(b, baseTs + i * interval))
    return {
      data: [...bars],
      intraday: true,
      toTime: (b, idx) =>
        ((timeMap.get(b) ?? baseTs + idx * interval) as unknown) as Time,
    }
  }
  const sorted = [...bars].sort((a, b) =>
    a.trade_date.localeCompare(b.trade_date),
  )
  return {
    data: sorted,
    intraday: false,
    toTime: b => (b.trade_date as unknown) as Time,
  }
}

// Filter out NaN data points (lightweight-charts rejects NaN entries).
function cleanFinite<T extends { value: number | null }>(arr: T[]): T[] {
  return arr.filter(d => d.value !== null && Number.isFinite(d.value))
}

// ChartCore deps 안정화 — 매 render 마다 새 object 생성을 막아 useEffect 의
// chart.remove + recreate 무한 사이클 (canvas 1x1 reset → 재생성, 12K mutations/s)
// 방지. 메인 pane 0 의 stretch 4 (sub-pane 1 의 4배 높이).
const PANE_STRETCH: Record<number, number> = { 0: 4 }

export function PatternChart({
  ohlcv,
  patterns,
  indicators: state,
  indicatorParams,
  chartType = 'candle',
  patternOffset = null,
  onPatternOffsetChange,
  patternWidth = 60,
  onPatternWidthChange,
  compareBars,
  compareLabel,
  compareColor = 'oklch(0.78 0.14 180)', // --ko-accent-secondary 청록
  drawings,
  formatPrice,
  onChartClick,
}: PatternChartProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [chart, setChart] = useState<IChartApi | null>(null)
  const [mainSeries, setMainSeries] = useState<
    ISeriesApi<'Candlestick' | 'Line' | 'Area'> | null
  >(null)
  const [hoverBar, setHoverBar] = useState<OhlcvBar | null>(null)

  const { data: bars, intraday, toTime } = useMemo(
    () => prepareBars(ohlcv),
    [ohlcv],
  )

  // 활성화된 indicators 만 ChartCore 에 전달. paneIndex 동적 할당
  // (메인=0, 활성 sub-pane 순서대로 1,2,3,...)
  const indicators = useMemo<ChartIndicatorSeries[]>(() => {
    if (bars.length === 0) return []
    const result: ChartIndicatorSeries[] = []
    let nextPane = 1

    const closes = bars.map(b => Number(b.close))
    const highs = bars.map(b => Number(b.high))
    const lows = bars.map(b => Number(b.low))
    const volumes = bars.map(b => Number(b.volume))

    // ─ Main pane (paneIndex 0) overlays ──────────────────────────────────
    const maConfigs: Array<[keyof Indicators, number, string]> = [
      ['ma5', indicatorParams?.ma5Period ?? 5, '#f59e0b'],
      ['ma20', indicatorParams?.ma20Period ?? 20, '#3b82f6'],
      ['ma60', indicatorParams?.ma60Period ?? 60, '#a855f7'],
      ['ma120', indicatorParams?.ma120Period ?? 120, '#ec4899'],
    ]
    maConfigs.forEach(([key, period, color]) => {
      if (!state[key]) return
      const vals = calcMA(closes, period)
      result.push({
        name: `MA${period}`,
        paneIndex: 0,
        type: 'line',
        color,
        lineWidth: 1,
        data: cleanFinite(
          bars.map((b, i) => ({
            time: toTime(b, i),
            value: vals[i] ?? null,
          })),
        ).map(d => ({ time: d.time, value: d.value as number })),
      })
    })

    if (state.bb) {
      const bbPeriod = indicatorParams?.bbPeriod ?? 20
      const bbStd = indicatorParams?.bbStdDev ?? 2
      const bb = calcBollingerBands(closes, bbPeriod, bbStd)
      const filtered = bars
        .map((b, i) => ({ b, i, pt: bb[i] }))
        .filter(d => d.pt !== null)
      result.push({
        name: 'BB-upper',
        paneIndex: 0,
        type: 'line',
        color: '#06b6d4',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        data: filtered.map(d => ({ time: toTime(d.b, d.i), value: d.pt!.upper })),
      })
      result.push({
        name: 'BB-lower',
        paneIndex: 0,
        type: 'line',
        color: '#06b6d4',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        data: filtered.map(d => ({ time: toTime(d.b, d.i), value: d.pt!.lower })),
      })
    }

    if (state.vwap) {
      const vwapVals = calcVWAP(highs, lows, closes, volumes)
      result.push({
        name: 'VWAP',
        paneIndex: 0,
        type: 'line',
        color: '#60a5fa',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        data: cleanFinite(
          bars.map((b, i) => ({
            time: toTime(b, i),
            value: vwapVals[i] ?? null,
          })),
        ).map(d => ({ time: d.time, value: d.value as number })),
      })
    }

    // ─ Volume sub-pane ────────────────────────────────────────────────────
    if (state.volume) {
      const paneIdx = nextPane++
      result.push({
        name: 'Volume',
        paneIndex: paneIdx,
        type: 'histogram',
        data: bars.map((b, i) => ({
          time: toTime(b, i),
          value: Number(b.volume),
          color:
            Number(b.close) >= Number(b.open)
              ? 'rgba(250,97,109,0.4)' // quote-rise alpha
              : 'rgba(52,133,250,0.4)', // quote-fall alpha
        })),
      })
    }

    // ─ RSI ───────────────────────────────────────────────────────────────
    if (state.rsi) {
      const paneIdx = nextPane++
      const period = indicatorParams?.rsiPeriod ?? 14
      const rsiVals = calcRSI(closes, period)
      result.push({
        name: `RSI(${period})`,
        paneIndex: paneIdx,
        type: 'line',
        color: '#8b5cf6',
        lineWidth: 1,
        data: cleanFinite(
          bars.map((b, i) => ({
            time: toTime(b, i),
            value: rsiVals[i] ?? null,
          })),
        ).map(d => ({ time: d.time, value: d.value as number })),
        priceLines: [
          { price: 70, color: '#ef4444', title: 'OB 70' },
          { price: 30, color: '#22c55e', title: 'OS 30' },
          { price: 50, color: '#475569', title: '', style: LineStyle.Dotted },
        ],
      })
    }

    // ─ MACD ──────────────────────────────────────────────────────────────
    if (state.macd) {
      const paneIdx = nextPane++
      const macdData = calcMACD(closes)
      const valid = bars
        .map((b, i) => ({ b, i, pt: macdData[i] }))
        .filter(d => d.pt !== null)
      result.push({
        name: 'MACD-hist',
        paneIndex: paneIdx,
        type: 'histogram',
        data: valid.map(d => ({
          time: toTime(d.b, d.i),
          value: d.pt!.histogram,
          color:
            d.pt!.histogram >= 0
              ? 'rgba(250,97,109,0.4)'
              : 'rgba(52,133,250,0.4)',
        })),
      })
      result.push({
        name: 'MACD',
        paneIndex: paneIdx,
        type: 'line',
        color: '#3b82f6',
        lineWidth: 1,
        data: valid.map(d => ({ time: toTime(d.b, d.i), value: d.pt!.macd })),
      })
      result.push({
        name: 'Signal',
        paneIndex: paneIdx,
        type: 'line',
        color: '#ef4444',
        lineWidth: 1,
        data: valid.map(d => ({ time: toTime(d.b, d.i), value: d.pt!.signal })),
      })
    }

    // ─ Stochastic ────────────────────────────────────────────────────────
    if (state.stochastic) {
      const paneIdx = nextPane++
      const k = indicatorParams?.stochasticK ?? 14
      const dPeriod = indicatorParams?.stochasticD ?? 3
      const slow = indicatorParams?.stochasticSlowing ?? 3
      const stoch = calcStochastic(highs, lows, closes, k, dPeriod, slow)
      const kData = cleanFinite(
        bars.map((b, i) => ({ time: toTime(b, i), value: stoch[i].k ?? null })),
      ).map(d => ({ time: d.time, value: d.value as number }))
      const dData = cleanFinite(
        bars.map((b, i) => ({ time: toTime(b, i), value: stoch[i].d ?? null })),
      ).map(d => ({ time: d.time, value: d.value as number }))
      result.push({
        name: 'Stoch %K',
        paneIndex: paneIdx,
        type: 'line',
        color: '#3b82f6',
        lineWidth: 1,
        data: kData,
        priceLines: [
          { price: 80, color: '#ef4444', title: 'OB 80' },
          { price: 20, color: '#22c55e', title: 'OS 20' },
        ],
      })
      result.push({
        name: 'Stoch %D',
        paneIndex: paneIdx,
        type: 'line',
        color: '#ef4444',
        lineWidth: 1,
        data: dData,
      })
    }

    // ─ Williams %R ───────────────────────────────────────────────────────
    if (state.williamsR) {
      const paneIdx = nextPane++
      const period = indicatorParams?.williamsRPeriod ?? 14
      const wrVals = calcWilliamsR(highs, lows, closes, period)
      result.push({
        name: `Williams%R(${period})`,
        paneIndex: paneIdx,
        type: 'line',
        color: '#a78bfa',
        lineWidth: 1,
        data: cleanFinite(
          bars.map((b, i) => ({
            time: toTime(b, i),
            value: wrVals[i] ?? null,
          })),
        ).map(d => ({ time: d.time, value: d.value as number })),
        priceLines: [
          { price: -20, color: '#ef4444', title: 'OB -20' },
          { price: -80, color: '#22c55e', title: 'OS -80' },
        ],
      })
    }

    // ─ ATR ───────────────────────────────────────────────────────────────
    if (state.atr) {
      const paneIdx = nextPane++
      const period = indicatorParams?.atrPeriod ?? 14
      const atrVals = calcATR(highs, lows, closes, period)
      result.push({
        name: `ATR(${period})`,
        paneIndex: paneIdx,
        type: 'line',
        color: '#fbbf24',
        lineWidth: 1,
        data: cleanFinite(
          bars.map((b, i) => ({
            time: toTime(b, i),
            value: atrVals[i] ?? null,
          })),
        ).map(d => ({ time: d.time, value: d.value as number })),
      })
    }

    // ─ OBV ───────────────────────────────────────────────────────────────
    if (state.obv) {
      const paneIdx = nextPane++
      const obvVals = calcOBV(closes, volumes)
      result.push({
        name: 'OBV',
        paneIndex: paneIdx,
        type: 'line',
        color: '#34d399',
        lineWidth: 1,
        data: bars.map((b, i) => ({
          time: toTime(b, i),
          value: obvVals[i],
        })),
      })
    }

    // ─ Compare overlay (TG-12) ───────────────────────────────────────────
    // 비교 종목을 메인 첫 close 기준으로 정규화 (시작점 동일) → 같은 priceScale 에서 비교 가능.
    // raw 가격이 아니라 "메인과 동일 시작점에서 % 변동" 의미.
    if (compareBars && compareBars.length > 0 && bars.length > 0) {
      const mainFirst = Number(bars[0].close)
      const compFirst = Number(compareBars[0].close)
      if (Number.isFinite(mainFirst) && Number.isFinite(compFirst) && compFirst > 0) {
        const scale = mainFirst / compFirst
        const compareData = compareBars
          .map((b, i) => ({
            time: toTime(b, i),
            value: Number(b.close) * scale,
          }))
          .filter(d => Number.isFinite(d.value))
        result.push({
          name: compareLabel
            ? `${compareLabel} (정규화)`
            : 'Compare (정규화)',
          paneIndex: 0,
          type: 'line',
          color: compareColor,
          lineWidth: 2,
          data: compareData,
        })
      }
    }

    return result
  }, [
    bars,
    state,
    indicatorParams,
    toTime,
    compareBars,
    compareLabel,
    compareColor,
  ])

  const handleChartReady = useCallback(
    (
      c: IChartApi | null,
      ms: ISeriesApi<'Candlestick' | 'Line' | 'Area'> | null,
    ) => {
      setChart(c)
      setMainSeries(ms)
    },
    [],
  )

  const handleCrosshair = useCallback((info: ChartCrosshairInfo) => {
    setHoverBar(info.bar)
  }, [])

  // heikinashi 도 캔들 모드로 취급 — score 마커 anchor 가능
  const candleMode = chartType === 'candle' || chartType === 'heikinashi'
  const empty = bars.length === 0
  const subPaneCount = countActiveSubPanes(state)
  // Each sub-pane adds ~110-140px height. ChartCore total height = main 440 + (130 per pane).
  const totalHeight = 440 + subPaneCount * 130

  if (empty) {
    return (
      <div className="rounded-xl h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              className="text-slate-600"
            >
              <polyline
                points="5,30 12,20 20,25 28,10 35,15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="text-slate-400 font-medium">종목을 선택해주세요</p>
          <p className="text-slate-600 text-sm mt-1">
            차트와 패턴 분석을 확인할 수 있습니다
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative' }}
      className="ko-pattern-chart-wrapper rounded-xl"
    >
      <ChartCore
        bars={bars}
        chartType={chartType}
        indicators={indicators}
        onCrosshairMove={handleCrosshair}
        onChartClick={onChartClick}
        onChartReady={handleChartReady}
        toTime={toTime}
        height={totalHeight}
        paneStretch={PANE_STRETCH}
      />

      {/* OHLCV legend on crosshair hover */}
      {hoverBar && (
        <div className="absolute top-1 left-1 z-30 flex gap-3 px-2 py-1 rounded bg-slate-900/95 backdrop-blur text-[11px] font-mono pointer-events-none shadow-lg">
          <span className="text-slate-400">
            {hoverBar.trade_date}
            {hoverBar.bar_time && hoverBar.bar_time !== '00:00:00'
              ? ` ${hoverBar.bar_time.slice(0, 5)}`
              : ''}
          </span>
          <span className="text-slate-300">
            O{' '}
            <span className="text-white">
              {Number(hoverBar.open).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </span>
          <span className="text-slate-300">
            H{' '}
            <span style={{ color: 'var(--ko-quote-rise)' }}>
              {Number(hoverBar.high).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </span>
          <span className="text-slate-300">
            L{' '}
            <span style={{ color: 'var(--ko-quote-fall)' }}>
              {Number(hoverBar.low).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </span>
          <span className="text-slate-300">
            C{' '}
            <span
              style={{
                color:
                  Number(hoverBar.close) >= Number(hoverBar.open)
                    ? 'var(--ko-quote-rise)'
                    : 'var(--ko-quote-fall)',
              }}
            >
              {Number(hoverBar.close).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </span>
          <span className="text-slate-500">
            Vol {Number(hoverBar.volume).toLocaleString()}
          </span>
        </div>
      )}

      {/* User drawings (horizontal lines + trend lines) — TG-11 */}
      {chart && mainSeries && drawings && drawings.length > 0 && (
        <DrawingOverlay
          chart={chart}
          mainSeries={mainSeries}
          drawings={drawings}
          formatPrice={formatPrice}
        />
      )}

      {/* Pattern overlay (drag handles + score badge + matched/projected lines) */}
      {patterns.length > 0 && chart && mainSeries && (
        <PatternOverlay
          chart={chart}
          mainSeries={mainSeries}
          containerRef={wrapperRef}
          bars={bars}
          toTime={toTime}
          patterns={patterns}
          patternWidth={patternWidth}
          onPatternWidthChange={onPatternWidthChange}
          patternOffset={patternOffset}
          onPatternOffsetChange={onPatternOffsetChange}
          candleMode={candleMode}
          intraday={intraday}
        />
      )}
    </div>
  )
}

function countActiveSubPanes(s: Indicators): number {
  let n = 0
  if (s.volume) n++
  if (s.rsi) n++
  if (s.macd) n++
  if (s.stochastic) n++
  if (s.williamsR) n++
  if (s.atr) n++
  if (s.obv) n++
  return n
}
