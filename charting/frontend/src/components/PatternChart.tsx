// charting/frontend/src/components/PatternChart.tsx
import { useEffect, useRef, MutableRefObject } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type Time,
  type LogicalRange,
} from 'lightweight-charts'
import { addDays, format, parseISO } from 'date-fns'
import type { OhlcvBar } from '../api'
import type { PatternDefinition } from '../lib/patterns'
import type { Indicators } from './IndicatorToggle'
import { calcMA, calcBollingerBands, calcRSI, calcMACD } from '../lib/indicators'
import { interpolatePattern } from '../lib/patternMatcher'

const CHART_DEFAULTS = {
  layout: { background: { type: ColorType.Solid, color: '#0f172a' }, textColor: '#64748b' },
  grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: '#334155' },
  timeScale: { borderColor: '#334155', timeVisible: true, fixLeftEdge: false, fixRightEdge: false },
}

const WINDOW = 60
const PROJ_DAYS = 20

// ── Sub-chart panels ──────────────────────────────────────────────────────────

function VolumePanel({ ohlcv, mainRef }: { ohlcv: OhlcvBar[]; mainRef: MutableRefObject<IChartApi | null> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current || !mainRef.current) return
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 110, timeScale: { ...CHART_DEFAULTS.timeScale, visible: false } })

    const series = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'right' })
    series.setData(ohlcv.map(b => ({
      time: b.trade_date as Time,
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
  }, [ohlcv])
  return (
    <div className="border-t border-slate-800">
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-500">Volume</div>
      <div ref={containerRef} />
    </div>
  )
}

function RsiPanel({ ohlcv, mainRef }: { ohlcv: OhlcvBar[]; mainRef: MutableRefObject<IChartApi | null> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current || !mainRef.current) return
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 120, timeScale: { ...CHART_DEFAULTS.timeScale, visible: false } })

    const closes = ohlcv.map(b => Number(b.close))
    const rsiValues = calcRSI(closes)
    const series = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 1 })
    series.setData(
      ohlcv.map((b, i) => ({ time: b.trade_date as Time, value: rsiValues[i] ?? 50 }))
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
  }, [ohlcv])
  return (
    <div className="border-t border-slate-800">
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-500">RSI (14)</div>
      <div ref={containerRef} />
    </div>
  )
}

function MacdPanel({ ohlcv, mainRef }: { ohlcv: OhlcvBar[]; mainRef: MutableRefObject<IChartApi | null> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current || !mainRef.current) return
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 140, timeScale: { ...CHART_DEFAULTS.timeScale, visible: false } })

    const closes = ohlcv.map(b => Number(b.close))
    const macdData = calcMACD(closes)

    const histSeries = chart.addHistogramSeries({ priceScaleId: 'right', lastValueVisible: false })
    const macdSeries = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1, lastValueVisible: false })
    const signalSeries = chart.addLineSeries({ color: '#ef4444', lineWidth: 1, lastValueVisible: false })

    const validData = ohlcv.map((b, i) => ({ time: b.trade_date as Time, point: macdData[i] })).filter(d => d.point !== null)

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
  }, [ohlcv])
  return (
    <div className="border-t border-slate-800">
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-500">MACD (12,26,9)</div>
      <div ref={containerRef} />
    </div>
  )
}

// ── Main chart ────────────────────────────────────────────────────────────────

interface Props {
  ohlcv: OhlcvBar[]
  patterns: PatternDefinition[]
  indicators: Indicators
}

export function PatternChart({ ohlcv, patterns, indicators }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current || ohlcv.length === 0) return
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 440 })
    chartRef.current = chart
    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }))
    ro.observe(containerRef.current)

    const closes = ohlcv.map(b => Number(b.close))

    // ── Candlestick ──────────────────────────────────────────────────────────
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#16a34a', borderDownColor: '#dc2626',
      wickUpColor: '#16a34a', wickDownColor: '#dc2626',
    })
    candleSeries.setData(ohlcv.map(b => ({
      time: b.trade_date as Time,
      open: Number(b.open), high: Number(b.high), low: Number(b.low), close: Number(b.close),
    })))

    // ── MA Lines ─────────────────────────────────────────────────────────────
    const maConfig = [
      { key: 'ma5'  as const, period: 5,  color: '#f59e0b' },
      { key: 'ma20' as const, period: 20, color: '#3b82f6' },
      { key: 'ma60' as const, period: 60, color: '#a855f7' },
    ]
    maConfig.forEach(({ key, period, color }) => {
      if (!indicators[key]) return
      const maValues = calcMA(closes, period)
      const series = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      series.setData(ohlcv.map((b, i) => ({ time: b.trade_date as Time, value: maValues[i] ?? NaN })).filter(d => !isNaN(d.value)))
    })

    // ── Bollinger Bands ──────────────────────────────────────────────────────
    if (indicators.bb) {
      const bb = calcBollingerBands(closes)
      const upperSeries = chart.addLineSeries({ color: '#06b6d4', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false })
      const lowerSeries = chart.addLineSeries({ color: '#06b6d4', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false })
      const filtered = ohlcv.map((b, i) => ({ time: b.trade_date as Time, pt: bb[i] })).filter(d => d.pt !== null)
      upperSeries.setData(filtered.map(d => ({ time: d.time, value: d.pt!.upper })))
      lowerSeries.setData(filtered.map(d => ({ time: d.time, value: d.pt!.lower })))
    }

    // ── Pattern Overlays + Projections (multi) ──────────────────────────────
    if (patterns.length > 0 && ohlcv.length >= WINDOW) {
      const windowBars = ohlcv.slice(-WINDOW)
      const windowCloses = windowBars.map(b => Number(b.close))
      const priceMin = Math.min(...windowCloses)
      const priceMax = Math.max(...windowCloses)
      const priceRange = priceMax - priceMin
      const scale = (y: number) => priceMin + y * priceRange
      const lastDate = parseISO(windowBars[windowBars.length - 1].trade_date)

      patterns.forEach((pattern) => {
        // Overlay (solid)
        const patternInterp = interpolatePattern(pattern.curve, WINDOW)
        const overlaySeries = chart.addLineSeries({
          color: pattern.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
          title: pattern.name,
        })
        overlaySeries.setData(
          windowBars.map((b, i) => ({ time: b.trade_date as Time, value: scale(patternInterp[i]) }))
        )

        // Projection (dashed)
        const projXMin = pattern.projection[0].x
        const projXMax = pattern.projection[pattern.projection.length - 1].x
        const projXRange = projXMax - projXMin
        const normalizedProj = pattern.projection.map(p => ({
          x: projXRange === 0 ? 0 : (p.x - projXMin) / projXRange,
          y: p.y,
        }))
        const projInterp = interpolatePattern(normalizedProj, PROJ_DAYS + 1)
        const projSeries = chart.addLineSeries({
          color: pattern.color, lineWidth: 2, lineStyle: LineStyle.Dashed,
          priceLineVisible: false, lastValueVisible: false,
        })
        projSeries.setData([
          { time: windowBars[windowBars.length - 1].trade_date as Time, value: scale(projInterp[0]) },
          ...Array.from({ length: PROJ_DAYS }, (_, i) => ({
            time: format(addDays(lastDate, i + 1), 'yyyy-MM-dd') as Time,
            value: scale(projInterp[i + 1]),
          })),
        ])

        // "Now" marker (only on first pattern to avoid clutter)
        if (pattern === patterns[0]) {
          overlaySeries.setMarkers([{
            time: windowBars[windowBars.length - 1].trade_date as Time,
            position: 'aboveBar',
            color: pattern.color,
            shape: 'arrowDown',
            text: 'Now',
          }])
        }
      })
    }

    chart.timeScale().fitContent()
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null }
  }, [ohlcv, patterns, indicators])

  return (
    <div className="rounded-xl overflow-hidden h-full">
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
        <div ref={containerRef} />
      )}
      {ohlcv.length > 0 && indicators.volume && <VolumePanel ohlcv={ohlcv} mainRef={chartRef} />}
      {ohlcv.length > 0 && indicators.rsi    && <RsiPanel    ohlcv={ohlcv} mainRef={chartRef} />}
      {ohlcv.length > 0 && indicators.macd   && <MacdPanel   ohlcv={ohlcv} mainRef={chartRef} />}
    </div>
  )
}
