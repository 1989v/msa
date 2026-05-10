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

export interface ChartClickInfo {
  /** Normalized — daily 'YYYY-MM-DD' / intraday epoch seconds (number). */
  time: string | number
  price: number
}

interface Props {
  bars: OhlcvBar[]
  chartType: ChartCoreType
  indicators?: ChartIndicatorSeries[]
  onCrosshairMove?: (info: ChartCrosshairInfo) => void
  /** Click on chart — 그리기 도구 (TG-11) 직접 클릭 모드용. */
  onChartClick?: (info: ChartClickInfo) => void
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
  /** Left price scale (TG-12 비교 종목용). 시리즈는 `priceScaleId: 'left'` 로 attach. */
  leftPriceScaleVisible?: boolean
  className?: string
  style?: CSSProperties
}

export function ChartCore({
  bars,
  chartType,
  indicators = [],
  onCrosshairMove,
  onChartClick,
  onChartReady,
  toTime: toTimeProp,
  height = 440,
  paneStretch,
  leftPriceScaleVisible,
  className,
  style,
}: Props) {
  const toTime = toTimeProp ?? defaultBarToTimeKey
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [chartReady, setChartReady] = useState(false)

  // Callback props 를 ref 에 보관 — useEffect deps 에서 제외하여
  // 부모 re-render 마다 차트 전체 재생성 (chart.remove + recreate) 회피.
  // ForcedReflow 비용의 많은 부분이 매번의 chart 재초기화에서 발생.
  const onCrosshairMoveRef = useRef(onCrosshairMove)
  const onChartClickRef = useRef(onChartClick)
  const onChartReadyRef = useRef(onChartReady)
  useEffect(() => {
    onCrosshairMoveRef.current = onCrosshairMove
    onChartClickRef.current = onChartClick
    onChartReadyRef.current = onChartReady
  }, [onCrosshairMove, onChartClick, onChartReady])

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
      leftPriceScale: {
        visible: !!leftPriceScaleVisible,
        borderColor: tokens.borderSubtle,
      },
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
    // ref 통해 호출 — 부모가 callback 을 새로 만들어 넘겨도 재구독 불필요.
    const barByTime = new Map<string, OhlcvBar>()
    sortedBars.forEach((b, i) => {
      const key = timeKeyToString(toTime(b, i))
      barByTime.set(key, b)
    })
    chart.subscribeCrosshairMove(param => {
      const cb = onCrosshairMoveRef.current
      if (!cb) return
      if (!param.time) {
        cb({ time: null, bar: null })
        return
      }
      const key = timeKeyToString(param.time)
      cb({ time: param.time, bar: barByTime.get(key) ?? null })
    })

    // ── Click handler (drawing mode) ─────────────────────────────────────────
    chart.subscribeClick(param => {
      const cb = onChartClickRef.current
      if (!cb) return
      if (!param.time || !param.point) return
      const price = mainSeries.coordinateToPrice(param.point.y)
      if (price == null || !Number.isFinite(price)) return
      const t = param.time
      const normalized: string | number =
        typeof t === 'number' || typeof t === 'string'
          ? t
          : `${(t as { year: number }).year}-${String((t as { month: number }).month).padStart(2, '0')}-${String((t as { day: number }).day).padStart(2, '0')}`
      cb({ time: normalized, price: Number(price) })
    })

    chart.timeScale().fitContent()
    setChartReady(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onChartReadyRef.current?.(chart, mainSeries as any)

    // ResizeObserver — entries[0].contentRect 사용 (forced layout 회피).
    // 추가 안전장치: ① 마지막 적용 width 와 비교하여 동일 시 skip — applyOptions 가
    // canvas attribute 변경 → layout 재계산 → ResizeObserver 재호출 의 무한 loop
    // 방지 (이전: 초당 12,000+ canvas mutations 발생). ② rAF debounce — 한 frame
    // 동안 여러 entry 가 와도 마지막 1회만 적용.
    let lastAppliedWidth = -1
    let rafId: number | null = null
    const ro = new ResizeObserver((entries) => {
      const raw = entries[0]?.contentRect.width
      if (typeof raw !== 'number' || raw <= 0) return
      const w = Math.floor(raw)
      if (w === lastAppliedWidth) return
      if (rafId != null) return
      rafId = window.requestAnimationFrame(() => {
        rafId = null
        if (w !== lastAppliedWidth) {
          lastAppliedWidth = w
          chart.applyOptions({ width: w })
        }
      })
    })
    ro.observe(containerRef.current)

    return () => {
      if (rafId != null) window.cancelAnimationFrame(rafId)
      ro.disconnect()
      onChartReadyRef.current?.(null, null)
      chart.remove()
      setChartReady(false)
    }
    // callback ref 패턴 적용 — onCrosshairMove/onChartClick/onChartReady 는 deps 에서 제외.
    // toTimeProp 도 toTime (resolved) 만 deps 에 두면 된다 (toTime 자체가 toTimeProp 에 의존).
  }, [
    bars,
    chartType,
    indicators,
    height,
    paneStretch,
    toTime,
    leftPriceScaleVisible,
  ])

  return (
    <div
      ref={containerRef}
      className={className}
      // minHeight 부여 — bars 가 fetch 전 비어 있을 때도 차트 영역이 자리 잡혀
      // CLS (Cumulative Layout Shift) 안정화. 데이터 도착 후에도 동일 height.
      style={{ width: '100%', height, minHeight: height, ...style }}
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

/** lightweight-charts v5 는 hex/rgb/rgba 만 파싱 — OKLCH reject.
 *  fallback 토큰 모두 hex (DESIGN.md 의 hex 매핑 그대로). */
const DEFAULT_TOKENS: ResolvedTokens = {
  surface0: '#0c1424',
  surface1: '#1a2238',
  borderSubtle: '#2c3550',
  borderStrong: '#475569',
  textPrimary: '#f1f5f9',
  textMuted: '#94a3b8',
  quoteRise: '#FA616D',
  quoteFall: '#3485FA',
  accentPrimary: '#0ea5e9',
}

/**
 * lightweight-charts v5 는 hex/rgb/rgba 만 파싱 — OKLCH 미지원.
 * Chrome/Safari/Firefox 모두 OKLCH → sRGB native 변환 안 함 (Canvas fillStyle / getComputedStyle 모두 oklch 그대로 반환).
 * 결국 차트 색상 토큰은 CSS var 동적 갱신 X, 항상 hex DEFAULT_TOKENS 사용.
 *
 * 단, css var 가 hex/rgb 로 명시되어 있다면 (light/dark theme custom theme 도구 등) 그대로 사용.
 */
function readTokens(): ResolvedTokens {
  if (typeof window === 'undefined') return DEFAULT_TOKENS
  const cs = getComputedStyle(document.documentElement)
  const get = (name: string, fallback: string): string => {
    const raw = cs.getPropertyValue(name).trim()
    if (!raw) return fallback
    // hex / rgb / rgba 만 통과, 그 외 (oklch/lab/hsl) 는 fallback (lwc 미파싱)
    if (raw.startsWith('#') || raw.startsWith('rgb')) return raw
    return fallback
  }
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
