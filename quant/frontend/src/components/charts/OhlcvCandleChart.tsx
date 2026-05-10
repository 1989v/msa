import { useMemo } from 'react'
import {
  ChartCore,
  type ChartIndicatorSeries,
} from '@/charting/components/ChartCore'
import type { OhlcvBar as OhlcvBarNum } from '@/charting/api'

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
  /** Single line-overlay indicator (legacy SMA/EMA/RSI). RSI 같은 oscillator 도
   *  paneIndex 0 overlay 로 표시 — 정통 sub-pane 분리는 ChartCore 직접 호출 필요. */
  indicator?: { type: string; series: Record<string, IndicatorPoint[]> }
  height?: number
}

/**
 * OhlcvCandleChart — ADR-0033 Phase 1 의 캔들 + indicator overlay 컴포넌트.
 * TG-2-B 부터는 ChartCore 위임 (lightweight-charts v5 panes API). 외부 인터페이스 보존.
 */
export function OhlcvCandleChart({ bars, indicator, height = 360 }: Props) {
  const converted = useMemo<OhlcvBarNum[]>(
    () =>
      bars.map(b => {
        const [date, timepart] = (b.ts || '').split('T')
        return {
          trade_date: date,
          bar_time:
            timepart && !timepart.startsWith('00:00:00')
              ? timepart.slice(0, 8)
              : null,
          open: Number(b.open),
          high: Number(b.high),
          low: Number(b.low),
          close: Number(b.close),
          volume: Number(b.volume),
        }
      }),
    [bars],
  )

  const indicators = useMemo<ChartIndicatorSeries[]>(() => {
    if (!indicator) return []
    return Object.entries(indicator.series).map(([name, points], idx) => ({
      name,
      paneIndex: 0, // legacy overlay on price pane
      type: 'line' as const,
      color: PALETTE[idx % PALETTE.length],
      lineWidth: 1,
      data: points.map(p => ({
        time: Math.floor(new Date(p.ts).getTime() / 1000) as unknown as import('lightweight-charts').Time,
        value: Number(p.value),
      })),
    }))
  }, [indicator])

  return (
    <ChartCore
      bars={converted}
      chartType="candle"
      indicators={indicators}
      height={height}
    />
  )
}

/** Design-system accent palette (primary blue / secondary teal / amber).
 *  lightweight-charts 가 oklch literal 미지원 → hex 로 사전 변환 (디자인 토큰 동등). */
const PALETTE = [
  '#3b82f6', // primary blue
  '#14b8a6', // secondary teal
  '#84cc16', // amber-green
]
