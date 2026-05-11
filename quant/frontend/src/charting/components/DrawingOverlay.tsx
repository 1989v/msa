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

interface SortedPoint {
  time: Time
  value: number
}

function timeToNumber(t: Time): number {
  if (typeof t === 'number') return t
  if (typeof t === 'string') {
    const ms = Date.parse(t)
    return Number.isFinite(ms) ? ms / 1000 : 0
  }
  const d = t as { year: number; month: number; day: number }
  return Date.UTC(d.year, d.month - 1, d.day) / 1000
}

function sortByTime(a: SortedPoint, b: SortedPoint): SortedPoint[] {
  return timeToNumber(a.time) <= timeToNumber(b.time) ? [a, b] : [b, a]
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
        // 라인 더 두껍고 solid 로 — dashed lineWidth=1 은 시각적으로 너무 약함
        const line = mainSeries.createPriceLine({
          price: d.price,
          color: d.color,
          lineWidth: 2,
          lineStyle: LineStyle.Solid,
          axisLabelVisible: true,
          title: `📍 ${title}`,
        })
        priceLinesRef.current.push(line)
      } else if (d.kind === 'trend-line') {
        // 두 점 LineSeries 로 추세선 그리기 (paneIndex 0)
        // lightweight-charts 는 ascending order 요구 — 사용자가 오→왼 클릭한 경우
        // setData 가 silently reject 되어 선이 안 보이던 버그 차단.
        const sorted = sortByTime(
          { time: d.startTime as unknown as Time, value: d.startPrice },
          { time: d.endTime as unknown as Time, value: d.endPrice },
        )
        const series = chart.addSeries(
          LineSeries,
          {
            color: d.color,
            lineWidth: 3,
            lineStyle: LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          },
          0,
        )
        series.setData(sorted)
        trendSeriesRef.current.push(series)
      } else if (d.kind === 'measure') {
        // 측정도구 — dashed line + 시작/끝 priceLine 라벨 (가격 변동% 표시)
        const sorted = sortByTime(
          { time: d.startTime as unknown as Time, value: d.startPrice },
          { time: d.endTime as unknown as Time, value: d.endPrice },
        )
        const series = chart.addSeries(
          LineSeries,
          {
            color: d.color,
            lineWidth: 2,
            lineStyle: LineStyle.Dotted,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          },
          0,
        )
        series.setData(sorted)
        trendSeriesRef.current.push(series)
        // 끝점 priceLine 으로 변동% 표시
        const changePct = d.startPrice > 0
          ? ((d.endPrice - d.startPrice) / d.startPrice) * 100
          : 0
        const sign = changePct >= 0 ? '+' : ''
        const line = mainSeries.createPriceLine({
          price: d.endPrice,
          color: d.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${sign}${changePct.toFixed(2)}%`,
        })
        priceLinesRef.current.push(line)
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
