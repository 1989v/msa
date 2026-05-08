// charting/components/ChartCore.tsx
//
// lightweight-charts v5 panes API 통합 래퍼.
// - bars / chartType / indicators 만 받아 단일 chart + multi-pane 으로 합성
// - 색상은 getComputedStyle 로 --ko-* 토큰 동적 추출 (DESIGN.md 1.1.0 sync)
// - paneIndex 규약:
//     0 = 가격 (메인 캔들/라인/영역)
//     1 = 거래량 (Histogram)
//     2 = oscillator (RSI / Stochastic / Williams %R / ATR)
//     3 = momentum (MACD / OBV)
// - 패턴 overlay·드래그 핸들·score 마커는 ChartCore 외부에서 좌표 변환으로 합성 (TG-2-C)
//
// 사용 예:
// ```
// <ChartCore
//   bars={ohlcv}
//   chartType="candle"
//   indicators={[
//     { name: 'MA20', paneIndex: 0, type: 'line', data: maData, color: '#3b82f6' },
//     { name: 'Volume', paneIndex: 1, type: 'histogram', data: volData },
//     { name: 'RSI', paneIndex: 2, type: 'line', data: rsiData,
//       priceLines: [{ price: 70, color: '#ef4444', title: 'OB 70' }, ...] },
//   ]}
//   onCrosshairMove={info => setHover(info.bar)}
// />
// ```
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts'
import type { OhlcvBar } from '../api'

export type ChartCoreType = 'candle' | 'line' | 'area' | 'heikinashi'

export interface ChartIndicatorPoint {
  time: Time
  value: number
  color?: string
}

export interface ChartIndicatorSeries {
  /** Stable key for diffing — defaults inferred from name+paneIndex. */
  name: string
  /** 0 = price (overlay), 1 = volume, 2 = oscillator, 3 = momentum. */
  paneIndex: number
  type: 'line' | 'histogram' | 'area'
  data: ChartIndicatorPoint[]
  color?: string
  lineWidth?: 1 | 2 | 3 | 4
  lineStyle?: LineStyle
  priceLines?: ChartPriceLine[]
  /** v5: explicit price scale id. Defaults: pane 0 = 'right', others = unique per pane. */
  priceScaleId?: string
}

export interface ChartPriceLine {
  price: number
  color: string
  title: string
  style?: LineStyle
  lineWidth?: 1 | 2 | 3 | 4
}

export interface ChartCrosshairInfo {
  time: Time | null
  bar: OhlcvBar | null
}

interface Props {
  bars: OhlcvBar[]
  chartType: ChartCoreType
  indicators?: ChartIndicatorSeries[]
  onCrosshairMove?: (info: ChartCrosshairInfo) => void
  /** Fires when the chart instance is created (and again with null on cleanup).
   *  Use this to attach overlays that need direct access to timeScale / priceScale. */
  onChartReady?: (
    chart: IChartApi | null,
    mainSeries: ISeriesApi<'Candlestick' | 'Line' | 'Area'> | null,
  ) => void
  /** Optional caller-supplied time-key resolver (intraday sequential vs UTC).
   *  Defaults to: bar_time present → unix epoch s (UTC), else trade_date string. */
  toTime?: (bar: OhlcvBar, index: number) => Time
  /** Total chart height including all panes. */
  height?: number
  /** Per-pane stretch factor (default: pane 0 = 4, others = 1). */
  paneStretch?: Record<number, number>
  className?: string
  style?: CSSProperties
}

export function ChartCore({
  bars,
  chartType,
  indicators = [],
  onCrosshairMove,
  onChartReady,
  toTime: toTimeProp,
  height = 440,
  paneStretch,
  className,
  style,
}: Props) {
  const toTime = toTimeProp ?? defaultBarToTimeKey
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [chartReady, setChartReady] = useState(false)

  useEffect(() => {
    if (!containerRef.current || bars.length === 0) return

    const tokens = readTokens()
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: tokens.textMuted,
        panes: {
          separatorColor: tokens.borderSubtle,
          separatorHoverColor: tokens.borderStrong,
          enableResize: true,
        },
      },
      grid: {
        vertLines: { color: tokens.borderSubtle },
        horzLines: { color: tokens.borderSubtle },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: tokens.borderSubtle },
      timeScale: {
        borderColor: tokens.borderSubtle,
        timeVisible: true,
        secondsVisible: false,
      },
    })

    // ── Main price series ────────────────────────────────────────────────────
    // Caller-supplied toTime preserves PatternChart's intraday-sequential mode;
    // default treats bar_time as UTC.
    const useCustomTime = !!toTimeProp
    const sortedBars = useCustomTime ? bars : sortBars(bars)
    const mainOhlc = sortedBars.map((b, i) => ({
      time: toTime(b, i),
      open: Number(b.open),
      high: Number(b.high),
      low: Number(b.low),
      close: Number(b.close),
    }))
    const mainCloseSeries = sortedBars.map((b, i) => ({
      time: toTime(b, i),
      value: Number(b.close),
    }))

    let mainSeries:
      | ISeriesApi<'Candlestick'>
      | ISeriesApi<'Line'>
      | ISeriesApi<'Area'>

    if (chartType === 'candle' || chartType === 'heikinashi') {
      const data = chartType === 'heikinashi' ? toHeikinAshi(mainOhlc) : mainOhlc
      const candle = chart.addSeries(
        CandlestickSeries,
        {
          upColor: tokens.quoteRise,
          downColor: tokens.quoteFall,
          borderUpColor: tokens.quoteRise,
          borderDownColor: tokens.quoteFall,
          wickUpColor: tokens.quoteRise,
          wickDownColor: tokens.quoteFall,
          borderVisible: false,
        },
        0,
      )
      candle.setData(data)
      mainSeries = candle
    } else if (chartType === 'line') {
      const line = chart.addSeries(
        LineSeries,
        { color: tokens.accentPrimary, lineWidth: 2 },
        0,
      )
      line.setData(mainCloseSeries)
      mainSeries = line
    } else {
      const area = chart.addSeries(
        AreaSeries,
        {
          topColor: withAlpha(tokens.accentPrimary, 0.4),
          bottomColor: withAlpha(tokens.accentPrimary, 0.02),
          lineColor: tokens.accentPrimary,
          lineWidth: 2,
        },
        0,
      )
      area.setData(mainCloseSeries)
      mainSeries = area
    }

    // ── Indicator series ─────────────────────────────────────────────────────
    indicators.forEach(ind => {
      const seriesType =
        ind.type === 'line'
          ? LineSeries
          : ind.type === 'histogram'
            ? HistogramSeries
            : AreaSeries
      // v5: pane 0 always uses default 'right'. Other panes auto-create.
      const opts: Record<string, unknown> = {
        color: ind.color ?? tokens.accentPrimary,
        priceLineVisible: false,
        lastValueVisible: false,
      }
      if (ind.type !== 'histogram') {
        opts.lineWidth = ind.lineWidth ?? 1
        if (ind.lineStyle != null) opts.lineStyle = ind.lineStyle
      }
      if (ind.type === 'histogram') {
        opts.priceFormat = { type: 'volume' }
      }
      if (ind.priceScaleId) opts.priceScaleId = ind.priceScaleId

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const series = chart.addSeries(seriesType as any, opts as any, ind.paneIndex)
      // Histogram setData requires { time, value, color? } — match by typing.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      series.setData(ind.data as any)
      ind.priceLines?.forEach(pl => {
        series.createPriceLine({
          price: pl.price,
          color: pl.color,
          lineWidth: pl.lineWidth ?? 1,
          lineStyle: pl.style ?? LineStyle.Dashed,
          axisLabelVisible: true,
          title: pl.title,
        })
      })
    })

    // ── Pane stretch factors ─────────────────────────────────────────────────
    const panes = chart.panes()
    const stretch = paneStretch ?? { 0: 4 }
    panes.forEach((p, i) => {
      const factor = stretch[i] ?? 1
      try {
        p.setStretchFactor(factor)
      } catch {
        // ignore — older runtime
      }
    })

    // ── Crosshair OHLCV legend ───────────────────────────────────────────────
    if (onCrosshairMove) {
      const barByTime = new Map<string, OhlcvBar>()
      sortedBars.forEach((b, i) => {
        const key = timeKeyToString(toTime(b, i))
        barByTime.set(key, b)
      })
      chart.subscribeCrosshairMove(param => {
        if (!param.time) {
          onCrosshairMove({ time: null, bar: null })
          return
        }
        const key = timeKeyToString(param.time)
        onCrosshairMove({ time: param.time, bar: barByTime.get(key) ?? null })
      })
    }

    chart.timeScale().fitContent()
    setChartReady(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChartReady?.(chart, mainSeries as any)

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      onChartReady?.(null, null)
      chart.remove()
      setChartReady(false)
    }
    // bars / indicators 변경 시 차트 재생성. 인스턴스 재사용은 TG-2-D 에서 imperative API 로 추후 최적화.
  }, [
    bars,
    chartType,
    indicators,
    height,
    paneStretch,
    onCrosshairMove,
    onChartReady,
    toTime,
    toTimeProp,
  ])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height, ...style }}
      data-chart-ready={chartReady ? 'true' : 'false'}
    />
  )
}

// ─── Token extraction ───────────────────────────────────────────────────────

interface ResolvedTokens {
  surface0: string
  surface1: string
  borderSubtle: string
  borderStrong: string
  textPrimary: string
  textMuted: string
  quoteRise: string
  quoteFall: string
  accentPrimary: string
}

const DEFAULT_TOKENS: ResolvedTokens = {
  surface0: 'oklch(0.17 0.025 252)',
  surface1: 'oklch(0.24 0.025 254)',
  borderSubtle: 'oklch(0.32 0.015 250)',
  borderStrong: 'oklch(0.55 0.02 250)',
  textPrimary: 'oklch(0.96 0.005 250)',
  textMuted: 'oklch(0.62 0.015 250)',
  quoteRise: 'oklch(0.69 0.20 18)',
  quoteFall: 'oklch(0.63 0.18 254)',
  accentPrimary: 'oklch(0.68 0.16 245)',
}

function readTokens(): ResolvedTokens {
  if (typeof window === 'undefined') return DEFAULT_TOKENS
  const cs = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string) =>
    cs.getPropertyValue(name).trim() || fallback
  return {
    surface0: get('--ko-surface-0', DEFAULT_TOKENS.surface0),
    surface1: get('--ko-surface-1', DEFAULT_TOKENS.surface1),
    borderSubtle: get('--ko-border-subtle', DEFAULT_TOKENS.borderSubtle),
    borderStrong: get('--ko-border-strong', DEFAULT_TOKENS.borderStrong),
    textPrimary: get('--ko-text-primary', DEFAULT_TOKENS.textPrimary),
    textMuted: get('--ko-text-muted', DEFAULT_TOKENS.textMuted),
    quoteRise: get('--ko-quote-rise', DEFAULT_TOKENS.quoteRise),
    quoteFall: get('--ko-quote-fall', DEFAULT_TOKENS.quoteFall),
    accentPrimary: get('--ko-accent-primary', DEFAULT_TOKENS.accentPrimary),
  }
}

/**
 * Add alpha channel to color. Works with hex (#RRGGBB), rgb(), and oklch().
 * Falls back to 'rgba(0,0,0,a)' on unparseable input.
 */
function withAlpha(color: string, alpha: number): string {
  const c = color.trim()
  if (c.startsWith('#') && (c.length === 7 || c.length === 4)) {
    const a = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0')
    if (c.length === 4) {
      // expand #abc -> #aabbcc
      const expanded = '#' + c.slice(1).split('').map(x => x + x).join('')
      return expanded + a
    }
    return c + a
  }
  if (c.startsWith('rgb(')) {
    return c.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
  }
  if (c.startsWith('oklch(')) {
    return `oklch(from ${c} l c h / ${alpha})`
  }
  return `rgba(0, 0, 0, ${alpha})`
}

// ─── Bar / time helpers ─────────────────────────────────────────────────────

function sortBars(bars: OhlcvBar[]): OhlcvBar[] {
  // Most callers already pass ascending order; resort defensively.
  return [...bars].sort((a, b) => {
    const cmp = a.trade_date.localeCompare(b.trade_date)
    if (cmp !== 0) return cmp
    return (a.bar_time ?? '').localeCompare(b.bar_time ?? '')
  })
}

/**
 * Default OhlcvBar → lightweight-charts Time key.
 * Daily (bar_time null/'00:00:00') → 'YYYY-MM-DD' string (BusinessDay-compatible).
 * Intraday → unix epoch seconds (assumes bar_time is already UTC).
 *
 * Callers needing PatternChart-style sequential intraday timestamps should
 * pass their own `toTime` prop.
 */
function defaultBarToTimeKey(b: OhlcvBar, _i: number): Time {
  if (!b.bar_time || b.bar_time.startsWith('00:00:00')) {
    return b.trade_date as unknown as Time
  }
  return Math.floor(
    new Date(`${b.trade_date}T${b.bar_time}Z`).getTime() / 1000,
  ) as Time
}

function timeKeyToString(t: Time): string {
  if (typeof t === 'number') return String(t)
  if (typeof t === 'string') return t
  // BusinessDay: { year, month, day }
  const d = t as { year: number; month: number; day: number }
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
}

// ─── Heikin-Ashi conversion ─────────────────────────────────────────────────

interface CandleData {
  time: Time
  open: number
  high: number
  low: number
  close: number
}

function toHeikinAshi(bars: CandleData[]): CandleData[] {
  if (bars.length === 0) return []
  const result: CandleData[] = []
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i]
    const haClose = (b.open + b.high + b.low + b.close) / 4
    const haOpen =
      i === 0
        ? (b.open + b.close) / 2
        : (result[i - 1].open + result[i - 1].close) / 2
    const haHigh = Math.max(b.high, haOpen, haClose)
    const haLow = Math.min(b.low, haOpen, haClose)
    result.push({
      time: b.time,
      open: haOpen,
      high: haHigh,
      low: haLow,
      close: haClose,
    })
  }
  return result
}
