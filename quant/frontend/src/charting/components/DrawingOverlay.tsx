// charting/components/DrawingOverlay.tsx
//
// 사용자 그리기 (가로선 prototype) 를 메인 시리즈의 PriceLine 으로 렌더.
// 추가/삭제는 ChartsPage 가 lib/drawing.ts 의 IO 호출 후 drawings prop 갱신.
import { useEffect, useRef } from 'react'
import {
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts'
import type { Drawing } from '../lib/drawing'

interface Props {
  chart: IChartApi
  mainSeries: ISeriesApi<'Candlestick' | 'Line' | 'Area'>
  drawings: Drawing[]
  /** Optional 가격 포맷터 — title 표시용. */
  formatPrice?: (n: number) => string
}

export function DrawingOverlay({ chart, mainSeries, drawings, formatPrice }: Props) {
  const priceLinesRef = useRef<IPriceLine[]>([])
  const trendSeriesRef = useRef<ISeriesApi<'Line'>[]>([])

  useEffect(() => {
    // cleanup previous
    priceLinesRef.current.forEach(l => {
      try {
        mainSeries.removePriceLine(l)
      } catch {
        /* series detached */
      }
    })
    priceLinesRef.current = []

    trendSeriesRef.current.forEach(s => {
      try {
        chart.removeSeries(s)
      } catch {
        /* chart removed */
      }
    })
    trendSeriesRef.current = []

    drawings.forEach(d => {
      if (d.kind === 'horizontal-line') {
        const title = formatPrice ? formatPrice(d.price) : d.price.toLocaleString()
        const line = mainSeries.createPriceLine({
          price: d.price,
          color: d.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title,
        })
        priceLinesRef.current.push(line)
      } else if (d.kind === 'trend-line') {
        // 두 점 LineSeries 로 추세선 그리기 (paneIndex 0)
        const series = chart.addSeries(
          LineSeries,
          {
            color: d.color,
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          },
          0,
        )
        series.setData([
          { time: d.startTime as unknown as Time, value: d.startPrice },
          { time: d.endTime as unknown as Time, value: d.endPrice },
        ])
        trendSeriesRef.current.push(series)
      }
    })

    return () => {
      priceLinesRef.current.forEach(l => {
        try {
          mainSeries.removePriceLine(l)
        } catch {
          /* series detached */
        }
      })
      priceLinesRef.current = []
      trendSeriesRef.current.forEach(s => {
        try {
          chart.removeSeries(s)
        } catch {
          /* chart removed */
        }
      })
      trendSeriesRef.current = []
    }
  }, [drawings, chart, mainSeries, formatPrice])

  return null
}
