// charting/frontend/src/components/PatternChart.tsx
import { useEffect, useRef, useState, useCallback, MutableRefObject } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type Time,
  type LogicalRange,
} from 'lightweight-charts'
import { addDays, parseISO } from 'date-fns'
import type { OhlcvBar } from '../api'
import type { PatternDefinition } from '../lib/patterns'
import type { Indicators, IndicatorParams } from './IndicatorToggle'
import type { ChartType } from '../App'
import { calcMA, calcBollingerBands, calcRSI, calcMACD, calcStochastic, calcWilliamsR, calcATR, calcOBV, calcVWAP } from '../lib/indicators'
import { findBestMatchOffset, interpolatePattern, minMaxNormalize, pearsonCorr } from '../lib/patternMatcher'

const CHART_DEFAULTS = {
  layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: '#64748b' },
  grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: '#334155' },
  timeScale: { borderColor: '#334155', timeVisible: true, fixLeftEdge: false, fixRightEdge: false },
}

const WINDOW = 60
const PROJ_DAYS = 20

/** Prepare bars for lightweight-charts: detect intraday, assign sequential
 *  UTC timestamps for intraday bars, sort ascending, deduplicate. */
function prepareBars(bars: OhlcvBar[]): { data: OhlcvBar[]; intraday: boolean; toTime: (b: OhlcvBar, idx: number) => Time } {
  if (bars.length < 2) {
    return {
      data: [...bars],
      intraday: false,
      toTime: (b) => b.trade_date as string as Time,
    }
  }

  // Intraday = multiple bars share the same trade_date
  const intraday = bars[0].trade_date === bars[1].trade_date

  if (intraday) {
    // For intraday: use sequential timestamps starting from midnight UTC of trade_date
    // This avoids timezone issues with bar_time (KR stocks report UTC 00:00 for KST 09:00)
    const baseDate = new Date(bars[0].trade_date + 'T00:00:00Z')
    const baseTs = Math.floor(baseDate.getTime() / 1000)
    const interval = 5 * 60 // 5 minutes in seconds

    // Bars from API are already in chronological order, assign sequential timestamps
    const timeMap = new Map<OhlcvBar, number>()
    bars.forEach((b, i) => timeMap.set(b, baseTs + i * interval))

    return {
      data: [...bars], // keep API order (already chronological)
      intraday: true,
      toTime: (b, idx) => (timeMap.get(b) ?? (baseTs + idx * interval)) as unknown as Time,
    }
  }

  // Daily: sort by date, use date string as time
  const sorted = [...bars].sort((a, b) => a.trade_date.localeCompare(b.trade_date))
  return {
    data: sorted,
    intraday: false,
    toTime: (b) => b.trade_date as string as Time,
  }
}

// ── Sub-chart panels ──────────────────────────────────────────────────────────

function VolumePanel({ ohlcv: rawOhlcv, mainRef }: { ohlcv: OhlcvBar[]; mainRef: MutableRefObject<IChartApi | null> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current || !mainRef.current) return
    const { data: ohlcv, toTime } = prepareBars(rawOhlcv)
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 110, timeScale: { ...CHART_DEFAULTS.timeScale, visible: false } })

    const series = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'right' })
    series.setData(ohlcv.map((b, i) => ({
      time: toTime(b, i),
      value: Number(b.volume),
      color: Number(b.close) >= Number(b.open) ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)',
    })))

    const sync = (range: LogicalRange | null) => { if (range) chart.timeScale().setVisibleLogicalRange(range) }
    const syncBack = (range: LogicalRange | null) => { if (range) mainRef.current?.timeScale().setVisibleLogicalRange(range) }
    mainRef.current.timeScale().subscribeVisibleLogicalRangeChange(sync)
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncBack)

    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }))
    ro.observe(containerRef.current)
    return () => {
      mainRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(sync)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(syncBack)
      ro.disconnect()
      chart.remove()
    }
  }, [rawOhlcv])
  return (
    <div className="border-t border-slate-800">
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-500">Volume</div>
      <div ref={containerRef} />
    </div>
  )
}

function RsiPanel({ ohlcv: rawOhlcv, mainRef, period }: { ohlcv: OhlcvBar[]; mainRef: MutableRefObject<IChartApi | null>; period: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current || !mainRef.current) return
    const { data: ohlcv, toTime } = prepareBars(rawOhlcv)
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 120, timeScale: { ...CHART_DEFAULTS.timeScale, visible: false } })

    const closes = ohlcv.map(b => Number(b.close))
    const rsiValues = calcRSI(closes, period)
    const series = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 1 })
    series.setData(
      ohlcv.map((b, i) => ({ time: toTime(b, i), value: rsiValues[i] ?? 50 }))
        .filter((_, i) => rsiValues[i] !== null)
    )
    series.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OB 70' })
    series.createPriceLine({ price: 30, color: '#22c55e', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OS 30' })
    series.createPriceLine({ price: 50, color: '#475569', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' })

    const sync = (range: LogicalRange | null) => { if (range) chart.timeScale().setVisibleLogicalRange(range) }
    const syncBack = (range: LogicalRange | null) => { if (range) mainRef.current?.timeScale().setVisibleLogicalRange(range) }
    mainRef.current.timeScale().subscribeVisibleLogicalRangeChange(sync)
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncBack)

    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }))
    ro.observe(containerRef.current)
    return () => {
      mainRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(sync)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(syncBack)
      ro.disconnect()
      chart.remove()
    }
  }, [rawOhlcv, period])
  return (
    <div className="border-t border-slate-800">
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-500">RSI ({period})</div>
      <div ref={containerRef} />
    </div>
  )
}

function MacdPanel({ ohlcv: rawOhlcv, mainRef }: { ohlcv: OhlcvBar[]; mainRef: MutableRefObject<IChartApi | null> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current || !mainRef.current) return
    const { data: ohlcv, toTime } = prepareBars(rawOhlcv)
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 140, timeScale: { ...CHART_DEFAULTS.timeScale, visible: false } })

    const closes = ohlcv.map(b => Number(b.close))
    const macdData = calcMACD(closes)

    const histSeries = chart.addHistogramSeries({ priceScaleId: 'right', lastValueVisible: false })
    const macdSeries = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, lastValueVisible: false })
    const signalSeries = chart.addLineSeries({ color: '#ef4444', lineWidth: 1, lastValueVisible: false })

    const validData = ohlcv.map((b, i) => ({ time: toTime(b, i), point: macdData[i] })).filter(d => d.point !== null)

    histSeries.setData(validData.map(d => ({ time: d.time, value: d.point!.histogram, color: d.point!.histogram >= 0 ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)' })))
    macdSeries.setData(validData.map(d => ({ time: d.time, value: d.point!.macd })))
    signalSeries.setData(validData.map(d => ({ time: d.time, value: d.point!.signal })))

    const sync = (range: LogicalRange | null) => { if (range) chart.timeScale().setVisibleLogicalRange(range) }
    const syncBack = (range: LogicalRange | null) => { if (range) mainRef.current?.timeScale().setVisibleLogicalRange(range) }
    mainRef.current.timeScale().subscribeVisibleLogicalRangeChange(sync)
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncBack)

    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }))
    ro.observe(containerRef.current)
    return () => {
      mainRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(sync)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(syncBack)
      ro.disconnect()
      chart.remove()
    }
  }, [rawOhlcv])
  return (
    <div className="border-t border-slate-800">
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-500">MACD (12,26,9)</div>
      <div ref={containerRef} />
    </div>
  )
}

function StochasticPanel({ ohlcv: rawOhlcv, mainRef, kPeriod, dPeriod, slowing }: { ohlcv: OhlcvBar[]; mainRef: MutableRefObject<IChartApi | null>; kPeriod: number; dPeriod: number; slowing: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current || !mainRef.current) return
    const { data: ohlcv, toTime } = prepareBars(rawOhlcv)
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 120, timeScale: { ...CHART_DEFAULTS.timeScale, visible: false } })

    const highs = ohlcv.map(b => Number(b.high))
    const lows = ohlcv.map(b => Number(b.low))
    const closes = ohlcv.map(b => Number(b.close))
    const stochData = calcStochastic(highs, lows, closes, kPeriod, dPeriod, slowing)

    const kSeries = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, lastValueVisible: false })
    const dSeries = chart.addLineSeries({ color: '#ef4444', lineWidth: 1, lastValueVisible: false })

    const kData = ohlcv.map((b, i) => ({ time: toTime(b, i), value: stochData[i].k })).filter(d => d.value !== null) as { time: any; value: number }[]
    const dData = ohlcv.map((b, i) => ({ time: toTime(b, i), value: stochData[i].d })).filter(d => d.value !== null) as { time: any; value: number }[]

    kSeries.setData(kData)
    dSeries.setData(dData)
    kSeries.createPriceLine({ price: 80, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OB 80' })
    kSeries.createPriceLine({ price: 20, color: '#22c55e', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OS 20' })

    const sync = (range: LogicalRange | null) => { if (range) chart.timeScale().setVisibleLogicalRange(range) }
    const syncBack = (range: LogicalRange | null) => { if (range) mainRef.current?.timeScale().setVisibleLogicalRange(range) }
    mainRef.current.timeScale().subscribeVisibleLogicalRangeChange(sync)
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncBack)

    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }))
    ro.observe(containerRef.current)
    return () => {
      mainRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(sync)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(syncBack)
      ro.disconnect()
      chart.remove()
    }
  }, [rawOhlcv, kPeriod, dPeriod, slowing])
  return (
    <div className="border-t border-slate-800">
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-500">Stochastic ({kPeriod},{dPeriod},{slowing})</div>
      <div ref={containerRef} />
    </div>
  )
}

function WilliamsRPanel({ ohlcv: rawOhlcv, mainRef, period }: { ohlcv: OhlcvBar[]; mainRef: MutableRefObject<IChartApi | null>; period: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current || !mainRef.current) return
    const { data: ohlcv, toTime } = prepareBars(rawOhlcv)
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 120, timeScale: { ...CHART_DEFAULTS.timeScale, visible: false } })

    const highs = ohlcv.map(b => Number(b.high))
    const lows = ohlcv.map(b => Number(b.low))
    const closes = ohlcv.map(b => Number(b.close))
    const wrValues = calcWilliamsR(highs, lows, closes, period)

    const series = chart.addLineSeries({ color: '#a78bfa', lineWidth: 1 })
    series.setData(
      ohlcv.map((b, i) => ({ time: toTime(b, i), value: wrValues[i] ?? -50 }))
        .filter((_, i) => wrValues[i] !== null)
    )
    series.createPriceLine({ price: -20, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OB -20' })
    series.createPriceLine({ price: -80, color: '#22c55e', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OS -80' })

    const sync = (range: LogicalRange | null) => { if (range) chart.timeScale().setVisibleLogicalRange(range) }
    const syncBack = (range: LogicalRange | null) => { if (range) mainRef.current?.timeScale().setVisibleLogicalRange(range) }
    mainRef.current.timeScale().subscribeVisibleLogicalRangeChange(sync)
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncBack)

    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }))
    ro.observe(containerRef.current)
    return () => {
      mainRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(sync)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(syncBack)
      ro.disconnect()
      chart.remove()
    }
  }, [rawOhlcv, period])
  return (
    <div className="border-t border-slate-800">
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-500">Williams %R ({period})</div>
      <div ref={containerRef} />
    </div>
  )
}

function AtrPanel({ ohlcv: rawOhlcv, mainRef, period }: { ohlcv: OhlcvBar[]; mainRef: MutableRefObject<IChartApi | null>; period: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current || !mainRef.current) return
    const { data: ohlcv, toTime } = prepareBars(rawOhlcv)
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 110, timeScale: { ...CHART_DEFAULTS.timeScale, visible: false } })

    const highs = ohlcv.map(b => Number(b.high))
    const lows = ohlcv.map(b => Number(b.low))
    const closes = ohlcv.map(b => Number(b.close))
    const atrValues = calcATR(highs, lows, closes, period)

    const series = chart.addLineSeries({ color: '#fbbf24', lineWidth: 1 })
    series.setData(
      ohlcv.map((b, i) => ({ time: toTime(b, i), value: atrValues[i] ?? NaN }))
        .filter(d => !isNaN(d.value) && d.value !== null)
    )

    const sync = (range: LogicalRange | null) => { if (range) chart.timeScale().setVisibleLogicalRange(range) }
    const syncBack = (range: LogicalRange | null) => { if (range) mainRef.current?.timeScale().setVisibleLogicalRange(range) }
    mainRef.current.timeScale().subscribeVisibleLogicalRangeChange(sync)
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncBack)

    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }))
    ro.observe(containerRef.current)
    return () => {
      mainRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(sync)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(syncBack)
      ro.disconnect()
      chart.remove()
    }
  }, [rawOhlcv, period])
  return (
    <div className="border-t border-slate-800">
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-500">ATR ({period})</div>
      <div ref={containerRef} />
    </div>
  )
}

function ObvPanel({ ohlcv: rawOhlcv, mainRef }: { ohlcv: OhlcvBar[]; mainRef: MutableRefObject<IChartApi | null> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current || !mainRef.current) return
    const { data: ohlcv, toTime } = prepareBars(rawOhlcv)
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 110, timeScale: { ...CHART_DEFAULTS.timeScale, visible: false } })

    const closes = ohlcv.map(b => Number(b.close))
    const volumes = ohlcv.map(b => Number(b.volume))
    const obvValues = calcOBV(closes, volumes)

    const series = chart.addLineSeries({ color: '#34d399', lineWidth: 1 })
    series.setData(ohlcv.map((b, i) => ({ time: toTime(b, i), value: obvValues[i] })))

    const sync = (range: LogicalRange | null) => { if (range) chart.timeScale().setVisibleLogicalRange(range) }
    const syncBack = (range: LogicalRange | null) => { if (range) mainRef.current?.timeScale().setVisibleLogicalRange(range) }
    mainRef.current.timeScale().subscribeVisibleLogicalRangeChange(sync)
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncBack)

    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }))
    ro.observe(containerRef.current)
    return () => {
      mainRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(sync)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(syncBack)
      ro.disconnect()
      chart.remove()
    }
  }, [rawOhlcv])
  return (
    <div className="border-t border-slate-800">
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-500">OBV</div>
      <div ref={containerRef} />
    </div>
  )
}

// ── Main chart ────────────────────────────────────────────────────────────────

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
}

export function PatternChart({
  ohlcv,
  patterns,
  indicators,
  indicatorParams,
  chartType = 'candle',
  patternOffset,
  onPatternOffsetChange,
  patternWidth,
  onPatternWidthChange,
}: PatternChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const dragRef = useRef<{ startX: number; startOffset: number; startWidth: number; mode: 'move' | 'left' | 'right' }>({
    startX: 0, startOffset: 0, startWidth: 60, mode: 'move',
  })
  const [dragging, setDragging] = useState(false)
  const [dragScore, setDragScore] = useState<number | null>(null)
  const [overlayBounds, setOverlayBounds] = useState<{ left: number; right: number; top: number; height: number } | null>(null)
  const [effectiveOffset, setEffectiveOffset] = useState(0)
  const [hoverBar, setHoverBar] = useState<OhlcvBar | null>(null)
  const sortedRef = useRef<OhlcvBar[]>([])
  const toTimeRef = useRef<(b: OhlcvBar, idx: number) => Time>((b) => b.trade_date as string as Time)

  // Compute overlay screen bounds after chart renders
  const updateOverlayBounds = useCallback(() => {
    const chart = chartRef.current
    const sorted = sortedRef.current
    if (!chart || !patterns.length || sorted.length < 20) {
      setOverlayBounds(null)
      return
    }
    const W = Math.min(patternWidth ?? WINDOW, sorted.length)
    const startIdx = effectiveOffset
    const endIdx = Math.min(effectiveOffset + W - 1, sorted.length - 1)
    const startBar = sorted[startIdx]
    const endBar = sorted[endIdx]
    if (!startBar || !endBar) { setOverlayBounds(null); return }

    const x1 = chart.timeScale().timeToCoordinate(toTimeRef.current(startBar, startIdx))
    const x2 = chart.timeScale().timeToCoordinate(toTimeRef.current(endBar, endIdx))
    if (x1 === null || x2 === null) { setOverlayBounds(null); return }

    setOverlayBounds({
      left: Math.min(x1, x2),
      right: Math.max(x1, x2),
      top: 0,
      height: 440,
    })
  }, [ohlcv, patterns.length, patternWidth, effectiveOffset])

  // Document-level drag handlers
  useEffect(() => {
    if (!dragging) return
    const handleMouseMove = (e: MouseEvent) => {
      if (!chartRef.current || !ohlcv.length) return
      const barWidth = chartRef.current.timeScale().width() / ohlcv.length
      const deltaX = e.clientX - dragRef.current.startX
      const deltaBars = Math.round(deltaX / barWidth)
      const W = patternWidth ?? 60

      if (dragRef.current.mode === 'move') {
        const maxOffset = Math.max(0, ohlcv.length - W)
        const newOffset = Math.max(0, Math.min(maxOffset, dragRef.current.startOffset + deltaBars))
        onPatternOffsetChange?.(newOffset)
      } else if (dragRef.current.mode === 'right') {
        const newWidth = Math.max(20, Math.min(120, dragRef.current.startWidth + deltaBars))
        onPatternWidthChange?.(newWidth)
      } else if (dragRef.current.mode === 'left') {
        const widthDelta = -deltaBars
        const newWidth = Math.max(20, Math.min(120, dragRef.current.startWidth + widthDelta))
        const offsetDelta = dragRef.current.startWidth - newWidth
        const newOffset = Math.max(0, dragRef.current.startOffset + offsetDelta)
        onPatternOffsetChange?.(newOffset)
        onPatternWidthChange?.(newWidth)
      }
    }
    const handleMouseUp = () => setDragging(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, ohlcv.length, patternWidth, onPatternOffsetChange, onPatternWidthChange])

  const startDrag = useCallback((mode: 'move' | 'left' | 'right', e: React.MouseEvent) => {
    dragRef.current = {
      startX: e.clientX,
      startOffset: patternOffset ?? effectiveOffset,
      startWidth: patternWidth ?? 60,
      mode,
    }
    if (mode === 'move' && patternOffset == null) {
      onPatternOffsetChange?.(effectiveOffset)
    }
    setDragging(true)
    e.preventDefault()
    e.stopPropagation()
  }, [patternOffset, effectiveOffset, patternWidth, onPatternOffsetChange])

  useEffect(() => {
    if (!containerRef.current || ohlcv.length === 0) return

    const { data, intraday, toTime } = prepareBars(ohlcv)
    sortedRef.current = data
    toTimeRef.current = toTime

    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 440 })
    chartRef.current = chart
    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }))
    ro.observe(containerRef.current)

    const closes = data.map(b => Number(b.close))

    // ── Main series (candle / line / area) ────────────────────────────────────
    let candleSeries: any
    if (chartType === 'candle') {
      candleSeries = chart.addCandlestickSeries({
        upColor: '#22c55e', downColor: '#ef4444',
        borderUpColor: '#16a34a', borderDownColor: '#dc2626',
        wickUpColor: '#16a34a', wickDownColor: '#dc2626',
      })
      candleSeries.setData(data.map((b, i) => ({
        time: toTime(b, i),
        open: Number(b.open), high: Number(b.high), low: Number(b.low), close: Number(b.close),
      })))
    } else if (chartType === 'line') {
      candleSeries = chart.addLineSeries({
        color: '#3b82f6', lineWidth: 2,
        priceLineVisible: false, lastValueVisible: true,
        crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
      })
      candleSeries.setData(data.map((b, i) => ({
        time: toTime(b, i), value: Number(b.close),
      })))
    } else {
      candleSeries = chart.addAreaSeries({
        topColor: 'rgba(59,130,246,0.4)', bottomColor: 'rgba(59,130,246,0.02)',
        lineColor: '#3b82f6', lineWidth: 2,
        priceLineVisible: false, lastValueVisible: true,
        crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
      })
      candleSeries.setData(data.map((b, i) => ({
        time: toTime(b, i), value: Number(b.close),
      })))
    }

    // ── Crosshair → OHLCV legend ─────────────────────────────────────────────
    // Map both by date string (daily) and unix timestamp (intraday) for lookup
    const ohlcvByDate = new Map(data.map(b => [b.trade_date, b]))
    const ohlcvByTs = new Map(data.map((b, i) => {
      const t = toTime(b, i)
      return [typeof t === 'number' ? t : t, b] as const
    }))
    chart.subscribeCrosshairMove(param => {
      if (!param.time) { setHoverBar(null); return }
      if (typeof param.time === 'number') {
        // Intraday: unix timestamp
        setHoverBar(ohlcvByTs.get(param.time) ?? null)
      } else if (typeof param.time === 'string') {
        setHoverBar(ohlcvByDate.get(param.time) ?? null)
      } else if ('year' in param.time) {
        const key = `${param.time.year}-${String(param.time.month).padStart(2,'0')}-${String(param.time.day).padStart(2,'0')}`
        setHoverBar(ohlcvByDate.get(key) ?? null)
      } else {
        setHoverBar(null)
      }
    })

    // ── MA Lines ─────────────────────────────────────────────────────────────
    const maConfig = [
      { key: 'ma5'  as const, period: indicatorParams?.ma5Period ?? 5,   color: '#f59e0b' },
      { key: 'ma20' as const, period: indicatorParams?.ma20Period ?? 20,  color: '#3b82f6' },
      { key: 'ma60' as const, period: indicatorParams?.ma60Period ?? 60,  color: '#a855f7' },
      { key: 'ma120' as const, period: indicatorParams?.ma120Period ?? 120, color: '#ec4899' },
    ]
    maConfig.forEach(({ key, period, color }) => {
      if (!indicators[key]) return
      const maValues = calcMA(closes, period)
      const series = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      series.setData(data.map((b, i) => ({ time: toTime(b, i), value: maValues[i] ?? NaN })).filter(d => !isNaN(d.value)))
    })

    // ── Bollinger Bands ──────────────────────────────────────────────────────
    if (indicators.bb) {
      const bbPeriod = indicatorParams?.bbPeriod ?? 20
      const bbStdDev = indicatorParams?.bbStdDev ?? 2
      const bb = calcBollingerBands(closes, bbPeriod, bbStdDev)
      const upperSeries = chart.addLineSeries({ color: '#06b6d4', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false })
      const lowerSeries = chart.addLineSeries({ color: '#06b6d4', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false })
      const filtered = data.map((b, i) => ({ time: toTime(b, i), pt: bb[i] })).filter(d => d.pt !== null)
      upperSeries.setData(filtered.map(d => ({ time: d.time, value: d.pt!.upper })))
      lowerSeries.setData(filtered.map(d => ({ time: d.time, value: d.pt!.lower })))
    }

    // ── VWAP Overlay ─────────────────────────────────────────────────────────
    if (indicators.vwap) {
      const highs = data.map(b => Number(b.high))
      const lows = data.map(b => Number(b.low))
      const volumes = data.map(b => Number(b.volume))
      const vwapValues = calcVWAP(highs, lows, closes, volumes)
      const vwapSeries = chart.addLineSeries({ color: '#60a5fa', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false })
      vwapSeries.setData(
        data.map((b, i) => ({ time: toTime(b, i), value: vwapValues[i] ?? NaN })).filter(d => !isNaN(d.value))
      )
    }

    // Fit chart to actual data BEFORE adding projection series (which extend beyond data range)
    chart.timeScale().fitContent()

    // ── Pattern Overlays + Projections (multi) — smart/manual positioning ──────────
    patterns.forEach((p, idx) => {
      const W = Math.min(patternWidth ?? WINDOW, data.length)
      if (data.length < 20) return

      // Use manual offset or auto best-match
      let offset: number
      let score: number
      if (patternOffset != null) {
        offset = Math.max(0, Math.min(data.length - W, patternOffset))
        // Compute score at manual position
        const windowSlice = closes.slice(offset, offset + W)
        const normalized = minMaxNormalize(windowSlice)
        const interp = interpolatePattern(p.curve, W)
        const r = pearsonCorr(normalized, interp)
        score = Math.round(((r + 1) / 2) * 100)
      } else {
        const bestMatch = findBestMatchOffset(closes, p, W)
        if (!bestMatch) return
        offset = bestMatch.offset
        score = bestMatch.score
      }

      if (idx === 0) { setDragScore(score); setEffectiveOffset(offset) }

      const windowBars = data.slice(offset, offset + W)
      const windowCloses = windowBars.map(b => Number(b.close))
      const priceMin = Math.min(...windowCloses)
      const priceMax = Math.max(...windowCloses)
      const priceRange = priceMax - priceMin || 1
      const scalePrice = (y: number) => priceMin + y * priceRange

      // Overlay line (pattern curve mapped to best-match window)
      const interp = interpolatePattern(p.curve, W)
      const overlayData = windowBars.map((bar, i) => ({
        time: toTime(bar, offset + i),
        value: scalePrice(interp[i]),
      }))

      const overlaySeries = chart.addLineSeries({
        color: p.color,
        lineWidth: 2,
        lineStyle: 0,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      overlaySeries.setData(overlayData)

      // Projection (future extension from pattern end)
      const projXMin = p.projection[0].x
      const projXMax = p.projection[p.projection.length - 1].x
      const projXRange = projXMax - projXMin || 0.33
      const projInterp = interpolatePattern(
        p.projection.map(pt => ({ x: (pt.x - projXMin) / projXRange, y: pt.y })),
        PROJ_DAYS + 1,
      )
      const lastBarIdx = Math.min(offset + W - 1, data.length - 1)
      const lastBar = data[lastBarIdx]
      const lastDate = parseISO(lastBar.trade_date)
      const lastTime = toTime(lastBar, lastBarIdx)
      const projData = projInterp.map((y, i) => {
        if (intraday) {
          const baseTs = typeof lastTime === 'number' ? lastTime : Math.floor(new Date(lastBar.trade_date).getTime() / 1000)
          return { time: (baseTs + (i + 1) * 5 * 60) as unknown as Time, value: scalePrice(y) }
        }
        return { time: addDays(lastDate, i + 1).toISOString().slice(0, 10) as string as Time, value: scalePrice(y) }
      })

      const projSeries = chart.addLineSeries({
        color: p.color,
        lineWidth: 2,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      })
      projSeries.setData(projData)

      // Score marker on first pattern only
      if (idx === 0 && windowBars.length > 0 && typeof candleSeries.setMarkers === 'function') {
        const markerBar = windowBars[windowBars.length - 1]
        candleSeries.setMarkers([{
          time: toTime(markerBar, Math.min(offset + W - 1, data.length - 1)),
          position: 'aboveBar',
          color: p.color,
          shape: 'arrowDown',
          text: `${score}%`,
        }])
      }
    })

    // Update overlay bounds after initial render and on pan/zoom
    setTimeout(updateOverlayBounds, 50)
    const onRangeChange = () => updateOverlayBounds()
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange)

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange)
      ro.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, [ohlcv, patterns, indicators, indicatorParams, chartType, patternOffset, patternWidth, updateOverlayBounds])

  const patternColor = patterns[0]?.color ?? '#8b5cf6'

  return (
    <div className="rounded-xl h-full">
      {ohlcv.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 rounded-2xl bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
              <svg width="40" height="40" viewBox="0 0 40 40" className="text-slate-600">
                <polyline points="5,30 12,20 20,25 28,10 35,15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-slate-400 font-medium">종목을 선택해주세요</p>
            <p className="text-slate-600 text-sm mt-1">차트와 패턴 분석을 확인할 수 있습니다</p>
          </div>
        </div>
      ) : (
        <div ref={wrapperRef} style={{ position: 'relative' }}>
          <div ref={containerRef} />

          {/* OHLCV legend on crosshair hover */}
          {hoverBar && (
            <div className="absolute top-1 left-1 z-30 flex gap-3 px-2 py-1 rounded bg-slate-900/95 backdrop-blur text-[11px] font-mono pointer-events-none shadow-lg">
              <span className="text-slate-400">{hoverBar.trade_date}{hoverBar.bar_time && hoverBar.bar_time !== '00:00:00' ? ` ${hoverBar.bar_time.slice(0, 5)}` : ''}</span>
              <span className="text-slate-300">O <span className="text-white">{Number(hoverBar.open).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
              <span className="text-slate-300">H <span className="text-emerald-400">{Number(hoverBar.high).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
              <span className="text-slate-300">L <span className="text-rose-400">{Number(hoverBar.low).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
              <span className="text-slate-300">C <span className={Number(hoverBar.close) >= Number(hoverBar.open) ? 'text-emerald-400' : 'text-rose-400'}>{Number(hoverBar.close).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
              <span className="text-slate-500">Vol {Number(hoverBar.volume).toLocaleString()}</span>
            </div>
          )}

          {/* Semi-transparent overlay band + handles on pattern region */}
          {patterns.length > 0 && overlayBounds && (
            <>
              {/* Background band */}
              <div
                style={{
                  position: 'absolute',
                  left: overlayBounds.left,
                  top: overlayBounds.top,
                  width: overlayBounds.right - overlayBounds.left,
                  height: overlayBounds.height,
                  background: `${patternColor}08`,
                  borderLeft: `1px solid ${patternColor}30`,
                  borderRight: `1px solid ${patternColor}30`,
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              />

              {/* Center drag area (move) */}
              <div
                style={{
                  position: 'absolute',
                  left: overlayBounds.left + 12,
                  top: overlayBounds.top,
                  width: Math.max(0, overlayBounds.right - overlayBounds.left - 24),
                  height: overlayBounds.height,
                  cursor: dragging && dragRef.current.mode === 'move' ? 'grabbing' : 'grab',
                  zIndex: 11,
                }}
                onMouseDown={(e) => startDrag('move', e)}
              />

              {/* Left edge handle (resize) */}
              <div
                style={{
                  position: 'absolute',
                  left: overlayBounds.left - 4,
                  top: overlayBounds.top,
                  width: 12,
                  height: overlayBounds.height,
                  cursor: 'ew-resize',
                  zIndex: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseDown={(e) => startDrag('left', e)}
              >
                <div style={{
                  width: 4,
                  height: 40,
                  borderRadius: 2,
                  background: `${patternColor}60`,
                  transition: 'background 0.15s',
                }} className="hover:!bg-white/60" />
              </div>

              {/* Right edge handle (resize) */}
              <div
                style={{
                  position: 'absolute',
                  left: overlayBounds.right - 8,
                  top: overlayBounds.top,
                  width: 12,
                  height: overlayBounds.height,
                  cursor: 'ew-resize',
                  zIndex: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseDown={(e) => startDrag('right', e)}
              >
                <div style={{
                  width: 4,
                  height: 40,
                  borderRadius: 2,
                  background: `${patternColor}60`,
                  transition: 'background 0.15s',
                }} className="hover:!bg-white/60" />
              </div>

              {/* Score badge + reset button */}
              <div
                className="absolute z-20 flex gap-1.5 items-center"
                style={{
                  left: overlayBounds.left,
                  top: overlayBounds.top + 8,
                }}
              >
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white/90"
                  style={{ background: `${patternColor}90` }}
                >
                  {dragScore ?? '—'}%
                  {(patternWidth ?? 60) !== 60 && ` · ${patternWidth}봉`}
                </span>
                {patternOffset !== null && (
                  <button
                    className="rounded px-1.5 py-0.5 text-[10px] text-white/70 hover:text-white"
                    style={{ background: `${patternColor}60` }}
                    onClick={() => onPatternOffsetChange?.(null)}
                  >
                    ↺ 자동
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
      {ohlcv.length > 0 && indicators.volume     && <VolumePanel     ohlcv={ohlcv} mainRef={chartRef} />}
      {ohlcv.length > 0 && indicators.rsi        && <RsiPanel        ohlcv={ohlcv} mainRef={chartRef} period={indicatorParams?.rsiPeriod ?? 14} />}
      {ohlcv.length > 0 && indicators.macd       && <MacdPanel       ohlcv={ohlcv} mainRef={chartRef} />}
      {ohlcv.length > 0 && indicators.stochastic && <StochasticPanel ohlcv={ohlcv} mainRef={chartRef} kPeriod={indicatorParams?.stochasticK ?? 14} dPeriod={indicatorParams?.stochasticD ?? 3} slowing={indicatorParams?.stochasticSlowing ?? 3} />}
      {ohlcv.length > 0 && indicators.williamsR  && <WilliamsRPanel  ohlcv={ohlcv} mainRef={chartRef} period={indicatorParams?.williamsRPeriod ?? 14} />}
      {ohlcv.length > 0 && indicators.atr        && <AtrPanel        ohlcv={ohlcv} mainRef={chartRef} period={indicatorParams?.atrPeriod ?? 14} />}
      {ohlcv.length > 0 && indicators.obv        && <ObvPanel        ohlcv={ohlcv} mainRef={chartRef} />}
    </div>
  )
}
