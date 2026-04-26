import { useEffect, useRef } from 'react'
import {
  ColorType,
  createChart,
  IChartApi,
  ISeriesApi,
  LineStyle,
  SeriesMarker,
  Time,
} from 'lightweight-charts'
import type { BacktestFillView } from '@/types/api'

interface Props {
  fills: BacktestFillView[]
  /** 가격 차트 라인 데이터 (옵션). 미제공 시 fill 가격으로 보간 라인. */
  priceSeries?: Array<{ time: number; value: number }>
  height?: number
}

/**
 * lightweight-charts 기반 가격 + 매수/매도 마커 오버레이.
 * priceSeries 가 없으면 fills 의 price 로 단순 라인을 그려 placeholder 시각화.
 *
 * NOTE: lightweight-charts 4.x API 사용. 추후 5.x 마이그레이션 시 createChart 옵션 변동 가능.
 */
export function BacktestRunChart({ fills, priceSeries, height = 280 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#3a3a3a',
        fontFamily: 'Pretendard, system-ui, sans-serif',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#eeeeee', style: LineStyle.Dotted },
        horzLines: { color: '#eeeeee', style: LineStyle.Dotted },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    })
    chartRef.current = chart

    const lineSeries = chart.addLineSeries({
      color: '#666666',
      lineWidth: 2,
    })
    seriesRef.current = lineSeries

    function handleResize() {
      if (!el) return
      chart.applyOptions({ width: el.clientWidth })
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [height])

  useEffect(() => {
    const series = seriesRef.current
    if (!series) return

    const data =
      priceSeries && priceSeries.length > 0
        ? priceSeries
            .slice()
            .sort((a, b) => a.time - b.time)
            .map((p) => ({ time: p.time as Time, value: p.value }))
        : fills
            .slice()
            .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
            .map((f) => ({
              time: Math.floor(new Date(f.ts).getTime() / 1000) as Time,
              value: Number(f.price) || 0,
            }))

    series.setData(data)

    const markers: SeriesMarker<Time>[] = fills
      .slice()
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
      .map((f) => ({
        time: Math.floor(new Date(f.ts).getTime() / 1000) as Time,
        position: f.side === 'BUY' ? 'belowBar' : 'aboveBar',
        // 한국 관습: 매수=파랑(저가 진입), 매도=빨강(이익 실현)
        color: f.side === 'BUY' ? '#3a6cd6' : '#d64a4a',
        shape: f.side === 'BUY' ? 'arrowUp' : 'arrowDown',
        text: `${f.roundIndex + 1}`,
      }))
    series.setMarkers(markers)
  }, [fills, priceSeries])

  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-2xl border border-ink-100 bg-white"
      style={{ height }}
      role="img"
      aria-label="백테스트 결과 가격 차트와 매수/매도 마커"
    />
  )
}
