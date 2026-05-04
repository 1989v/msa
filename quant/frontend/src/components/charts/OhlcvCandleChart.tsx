import { useEffect, useRef } from 'react'
import {
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts'

interface OhlcvBar {
  ts: string
  open: string
  high: string
  low: string
  close: string
  volume: string
}

interface IndicatorPoint {
  ts: string
  value: string
}

interface Props {
  bars: OhlcvBar[]
  /** 단일 시리즈(SMA/EMA/RSI) overlay. RSI 는 별도 패널에 둬야 적절하지만 Phase 1 placeholder. */
  indicator?: { type: string; series: Record<string, IndicatorPoint[]> }
  height?: number
}

/**
 * OhlcvCandleChart — lightweight-charts 4.x 캔들 + 지표 overlay (ADR-0033 Phase 1).
 *
 * Phase 1 단순화:
 * - candlestick 메인
 * - 지표 시리즈는 line overlay (가격 차트와 같은 패널) — RSI 같은 oscillator 도 overlay 로 표시 (UX 정밀화는 Phase 2)
 */
export function OhlcvCandleChart({ bars, indicator, height = 360 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map())

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#3a3a3a' },
      grid: { vertLines: { color: '#eee' }, horzLines: { color: '#eee' } },
      timeScale: { timeVisible: true, secondsVisible: false },
    })
    const candle = chart.addCandlestickSeries({
      upColor: '#16a34a',
      downColor: '#dc2626',
      wickUpColor: '#16a34a',
      wickDownColor: '#dc2626',
      borderVisible: false,
    })
    chartRef.current = chart
    candleRef.current = candle

    const onResize = () => chart.applyOptions({ width: el.clientWidth })
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      indicatorSeriesRef.current.clear()
    }
  }, [height])

  useEffect(() => {
    const candle = candleRef.current
    if (!candle) return
    candle.setData(
      bars.map((b) => ({
        time: (Math.floor(new Date(b.ts).getTime() / 1000) as unknown) as Time,
        open: Number(b.open),
        high: Number(b.high),
        low: Number(b.low),
        close: Number(b.close),
      }))
    )
  }, [bars])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    // 기존 line series 정리
    indicatorSeriesRef.current.forEach((s) => chart.removeSeries(s))
    indicatorSeriesRef.current.clear()
    if (!indicator) return

    const palette = ['#2563eb', '#a855f7', '#f97316']
    Object.entries(indicator.series).forEach(([key, points], idx) => {
      const line = chart.addLineSeries({
        color: palette[idx % palette.length],
        lineWidth: 1,
      })
      line.setData(
        points.map((p) => ({
          time: (Math.floor(new Date(p.ts).getTime() / 1000) as unknown) as Time,
          value: Number(p.value),
        }))
      )
      indicatorSeriesRef.current.set(key, line)
    })
  }, [indicator])

  return <div ref={containerRef} style={{ width: '100%', height }} />
}
