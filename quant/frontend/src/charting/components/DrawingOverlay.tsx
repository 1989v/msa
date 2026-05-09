// charting/components/DrawingOverlay.tsx
//
// 사용자 그리기 (가로선 prototype) 를 메인 시리즈의 PriceLine 으로 렌더.
// 추가/삭제는 ChartsPage 가 lib/drawing.ts 의 IO 호출 후 drawings prop 갱신.
import { useEffect, useRef } from 'react'
import {
  LineStyle,
  type IPriceLine,
  type ISeriesApi,
} from 'lightweight-charts'
import type { Drawing } from '../lib/drawing'

interface Props {
  mainSeries: ISeriesApi<'Candlestick' | 'Line' | 'Area'>
  drawings: Drawing[]
  /** Optional 가격 포맷터 — title 표시용. */
  formatPrice?: (n: number) => string
}

export function DrawingOverlay({ mainSeries, drawings, formatPrice }: Props) {
  const linesRef = useRef<IPriceLine[]>([])

  useEffect(() => {
    // cleanup previous
    linesRef.current.forEach(l => {
      try {
        mainSeries.removePriceLine(l)
      } catch {
        /* series detached */
      }
    })
    linesRef.current = []

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
        linesRef.current.push(line)
      }
    })

    return () => {
      linesRef.current.forEach(l => {
        try {
          mainSeries.removePriceLine(l)
        } catch {
          /* series detached */
        }
      })
      linesRef.current = []
    }
  }, [drawings, mainSeries, formatPrice])

  return null
}
