// charting/components/DrawingPreviewOverlay.tsx
//
// 추세선·측정도구 그리기 중 첫 점 클릭 후 두번째 점 클릭 전까지
// 마우스 커서를 따라다니는 preview line (점선, 반투명).
// chart.subscribeCrosshairMove 으로 마우스 시간/가격 추적 후 LineSeries 로 prev 렌더.
import { useEffect, useRef } from 'react'
import {
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts'

export interface DrawingPreviewFirstPoint {
  time: string | number
  price: number
}

interface Props {
  chart: IChartApi
  mainSeries: ISeriesApi<'Candlestick' | 'Line' | 'Area'>
  firstPoint: DrawingPreviewFirstPoint
  mode: 'trend-line' | 'measure'
}

export function DrawingPreviewOverlay({
  chart,
  mainSeries,
  firstPoint,
  mode,
}: Props) {
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null)

  useEffect(() => {
    const color = mode === 'trend-line' ? '#14b8a6' : '#84cc16'
    const series = chart.addSeries(
      LineSeries,
      {
        color,
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      },
      0,
    )
    seriesRef.current = series

    // 초기 데이터 — 시작점만 (마우스 이동 시 끝점이 추가됨)
    series.setData([
      { time: firstPoint.time as unknown as Time, value: firstPoint.price },
    ])

    const handler = (param: Parameters<Parameters<typeof chart.subscribeCrosshairMove>[0]>[0]) => {
      const series = seriesRef.current
      if (!series) return
      if (!param.time || !param.point) {
        // 차트 밖 — 시작점만 유지
        series.setData([
          { time: firstPoint.time as unknown as Time, value: firstPoint.price },
        ])
        return
      }
      const price = mainSeries.coordinateToPrice(param.point.y)
      if (price == null || !Number.isFinite(price)) return
      const endTime = param.time as Time
      // 시간 순서 보정 — lightweight-charts 의 LineSeries 는 ascending order 요구
      const startT = firstPoint.time as unknown as Time
      const reversed = compareTime(startT, endTime) > 0
      const data = reversed
        ? [
            { time: endTime, value: Number(price) },
            { time: startT, value: firstPoint.price },
          ]
        : [
            { time: startT, value: firstPoint.price },
            { time: endTime, value: Number(price) },
          ]
      series.setData(data)
    }
    chart.subscribeCrosshairMove(handler)

    return () => {
      try {
        chart.unsubscribeCrosshairMove(handler)
      } catch {
        /* ignore */
      }
      try {
        if (seriesRef.current) chart.removeSeries(seriesRef.current)
      } catch {
        /* ignore */
      }
      seriesRef.current = null
    }
  }, [chart, mainSeries, firstPoint.time, firstPoint.price, mode])

  return null
}

function compareTime(a: Time, b: Time): number {
  // string (YYYY-MM-DD) / number (epoch s) / BusinessDay 모두 처리
  const av = timeToComparable(a)
  const bv = timeToComparable(b)
  return av - bv
}

function timeToComparable(t: Time): number {
  if (typeof t === 'number') return t
  if (typeof t === 'string') {
    // 'YYYY-MM-DD' → epoch ms
    const ms = Date.parse(t)
    return Number.isFinite(ms) ? ms / 1000 : 0
  }
  const d = t as { year: number; month: number; day: number }
  return Date.UTC(d.year, d.month - 1, d.day) / 1000
}
