// charting/components/PatternOverlay.tsx
//
// 패턴 매치 라인 + projection + 드래그 핸들 + score 마커.
// ChartCore 가 만든 chart 인스턴스 + mainSeries 를 받아 좌표 변환으로 합성한다.
//
// - 패턴 매치 라인 / projection 라인: chart.addSeries(LineSeries, ..., 0) 추가
// - score 마커: createSeriesMarkers(mainSeries, [...]) (candle 모드에서만)
// - DOM overlay (드래그 핸들 좌/우/중앙 + score badge): chart.timeScale().timeToCoordinate
//
// PatternChart 가 chart 인스턴스 변경 시 (chartType / bars 변경) 자동으로 cleanup → re-create.
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type RefObject,
} from 'react'
import {
  LineSeries,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from 'lightweight-charts'
import { addDays, parseISO } from 'date-fns'
import type { OhlcvBar } from '../api'
import type { PatternDefinition } from '../lib/patterns'
import {
  findBestMatchOffset,
  interpolatePattern,
  minMaxNormalize,
  pearsonCorr,
} from '../lib/patternMatcher'

const PROJ_DAYS = 20

interface Props {
  chart: IChartApi
  /** Combined union — matches ChartCore.onChartReady callback signature. */
  mainSeries: ISeriesApi<'Candlestick' | 'Line' | 'Area'>
  /** Wrapper element that contains the chart canvas. Drag handles are absolute-positioned over it. */
  containerRef: RefObject<HTMLDivElement>
  bars: OhlcvBar[]
  /** Already-prepared time-key getter from PatternChart (handles intraday vs daily). */
  toTime: (b: OhlcvBar, idx: number) => Time
  patterns: PatternDefinition[]
  /** Window width in bars (default 60). */
  patternWidth: number
  onPatternWidthChange?: (w: number) => void
  /** Pattern start offset in bars. null = auto best-match. */
  patternOffset: number | null
  onPatternOffsetChange?: (offset: number | null) => void
  /** Show score badge / drag handles only when chartType === 'candle'. */
  candleMode: boolean
  /** Whether bars are intraday (5m sequential) — affects projection time grid. */
  intraday: boolean
}

const WINDOW = 60

export function PatternOverlay({
  chart,
  mainSeries,
  containerRef,
  bars,
  toTime,
  patterns,
  patternWidth,
  onPatternWidthChange,
  patternOffset,
  onPatternOffsetChange,
  candleMode,
  intraday,
}: Props) {
  const [dragging, setDragging] = useState(false)
  const [dragScore, setDragScore] = useState<number | null>(null)
  const [effectiveOffset, setEffectiveOffset] = useState(0)
  const [bounds, setBounds] = useState<{
    left: number
    right: number
    top: number
    height: number
  } | null>(null)
  const dragRef = useRef<{
    startX: number
    startOffset: number
    startWidth: number
    mode: 'move' | 'left' | 'right'
  }>({ startX: 0, startOffset: 0, startWidth: WINDOW, mode: 'move' })

  // ── Series cleanup helper ─────────────────────────────────────────────────
  const seriesRefs = useRef<ISeriesApi<'Line'>[]>([])

  const cleanupSeries = useCallback(() => {
    seriesRefs.current.forEach(s => {
      try {
        chart.removeSeries(s)
      } catch {
        /* chart already removed */
      }
    })
    seriesRefs.current = []
  }, [chart])

  // ── Render pattern lines + score marker ───────────────────────────────────
  useEffect(() => {
    if (bars.length < 20 || patterns.length === 0) {
      cleanupSeries()
      setBounds(null)
      return
    }

    cleanupSeries()
    const closes = bars.map(b => Number(b.close))
    let firstScore: number | null = null
    let firstOffset = 0

    patterns.forEach((p, idx) => {
      const W = Math.min(patternWidth, bars.length)
      let offset: number
      let score: number
      if (patternOffset != null) {
        offset = Math.max(0, Math.min(bars.length - W, patternOffset))
        const windowSlice = closes.slice(offset, offset + W)
        const normalized = minMaxNormalize(windowSlice)
        const interp = interpolatePattern(p.curve, W)
        const r = pearsonCorr(normalized, interp)
        score = Math.round(((r + 1) / 2) * 100)
      } else {
        const best = findBestMatchOffset(closes, p, W)
        if (!best) return
        offset = best.offset
        score = best.score
      }
      if (idx === 0) {
        firstScore = score
        firstOffset = offset
      }

      const windowBars = bars.slice(offset, offset + W)
      const windowCloses = windowBars.map(b => Number(b.close))
      const priceMin = Math.min(...windowCloses)
      const priceMax = Math.max(...windowCloses)
      const priceRange = priceMax - priceMin || 1
      const scalePrice = (y: number) => priceMin + y * priceRange

      // Pattern overlay line
      const interp = interpolatePattern(p.curve, W)
      const overlayData = windowBars.map((bar, i) => ({
        time: toTime(bar, offset + i),
        value: scalePrice(interp[i]),
      }))
      const overlay = chart.addSeries(
        LineSeries,
        {
          color: p.color,
          lineWidth: 2,
          lineStyle: 0,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        },
        0,
      )
      overlay.setData(overlayData)
      seriesRefs.current.push(overlay)

      // Projection line
      const projXMin = p.projection[0].x
      const projXMax = p.projection[p.projection.length - 1].x
      const projXRange = projXMax - projXMin || 0.33
      const projInterp = interpolatePattern(
        p.projection.map(pt => ({ x: (pt.x - projXMin) / projXRange, y: pt.y })),
        PROJ_DAYS + 1,
      )
      const lastBarIdx = Math.min(offset + W - 1, bars.length - 1)
      const lastBar = bars[lastBarIdx]
      const lastDate = parseISO(lastBar.trade_date)
      const lastTime = toTime(lastBar, lastBarIdx)
      const projData = projInterp.map((y, i) => {
        if (intraday) {
          const baseTs =
            typeof lastTime === 'number'
              ? lastTime
              : Math.floor(new Date(lastBar.trade_date).getTime() / 1000)
          return {
            time: (baseTs + (i + 1) * 5 * 60) as unknown as Time,
            value: scalePrice(y),
          }
        }
        return {
          time: addDays(lastDate, i + 1)
            .toISOString()
            .slice(0, 10) as unknown as Time,
          value: scalePrice(y),
        }
      })
      const projSeries = chart.addSeries(
        LineSeries,
        {
          color: p.color,
          lineWidth: 2,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        },
        0,
      )
      projSeries.setData(projData)
      seriesRefs.current.push(projSeries)

      // Score marker (candle mode only — line/area can't visually anchor it)
      if (idx === 0 && candleMode && windowBars.length > 0) {
        const markerBar = windowBars[windowBars.length - 1]
        createSeriesMarkers(mainSeries, [
          {
            time: toTime(markerBar, lastBarIdx),
            position: 'aboveBar',
            color: p.color,
            shape: 'arrowDown',
            text: `${score}%`,
          },
        ])
      }
    })

    setDragScore(firstScore)
    setEffectiveOffset(firstOffset)
    return cleanupSeries
  }, [
    chart,
    mainSeries,
    bars,
    toTime,
    patterns,
    patternWidth,
    patternOffset,
    candleMode,
    intraday,
    cleanupSeries,
  ])

  // ── Compute drag-handle bounds in screen pixels ──────────────────────────
  const updateBounds = useCallback(() => {
    if (bars.length < 20 || patterns.length === 0) {
      setBounds(null)
      return
    }
    const W = Math.min(patternWidth, bars.length)
    const startIdx = effectiveOffset
    const endIdx = Math.min(startIdx + W - 1, bars.length - 1)
    const startBar = bars[startIdx]
    const endBar = bars[endIdx]
    if (!startBar || !endBar) {
      setBounds(null)
      return
    }
    const x1 = chart.timeScale().timeToCoordinate(toTime(startBar, startIdx))
    const x2 = chart.timeScale().timeToCoordinate(toTime(endBar, endIdx))
    if (x1 === null || x2 === null) {
      setBounds(null)
      return
    }
    const containerHeight = containerRef.current?.clientHeight ?? 440
    setBounds({
      left: Math.min(x1, x2),
      right: Math.max(x1, x2),
      top: 0,
      // chart 의 가격 pane (paneIndex 0) 만 추적이 까다로워 pane 0 의 stretch 비율로 추정
      height: Math.round(containerHeight * 0.66),
    })
  }, [bars, toTime, patterns.length, patternWidth, effectiveOffset, chart, containerRef])

  useEffect(() => {
    updateBounds()
    const onRange = () => updateBounds()
    const ts = chart.timeScale()
    ts.subscribeVisibleLogicalRangeChange(onRange)
    return () => {
      try {
        ts.unsubscribeVisibleLogicalRangeChange(onRange)
      } catch {
        /* chart already removed */
      }
    }
  }, [chart, updateBounds])

  // ── Drag handlers (document-level, attached only while dragging) ──────────
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const tsWidth = chart.timeScale().width()
      const barWidth = tsWidth / Math.max(bars.length, 1)
      const deltaX = e.clientX - dragRef.current.startX
      const deltaBars = Math.round(deltaX / barWidth)
      const W = patternWidth

      if (dragRef.current.mode === 'move') {
        const maxOffset = Math.max(0, bars.length - W)
        const newOffset = Math.max(
          0,
          Math.min(maxOffset, dragRef.current.startOffset + deltaBars),
        )
        onPatternOffsetChange?.(newOffset)
      } else if (dragRef.current.mode === 'right') {
        const newWidth = Math.max(
          20,
          Math.min(120, dragRef.current.startWidth + deltaBars),
        )
        onPatternWidthChange?.(newWidth)
      } else if (dragRef.current.mode === 'left') {
        const widthDelta = -deltaBars
        const newWidth = Math.max(
          20,
          Math.min(120, dragRef.current.startWidth + widthDelta),
        )
        const offsetDelta = dragRef.current.startWidth - newWidth
        const newOffset = Math.max(
          0,
          dragRef.current.startOffset + offsetDelta,
        )
        onPatternOffsetChange?.(newOffset)
        onPatternWidthChange?.(newWidth)
      }
    }
    const onUp = () => setDragging(false)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [
    dragging,
    chart,
    bars.length,
    patternWidth,
    onPatternOffsetChange,
    onPatternWidthChange,
  ])

  const startDrag = useCallback(
    (mode: 'move' | 'left' | 'right', e: React.MouseEvent) => {
      dragRef.current = {
        startX: e.clientX,
        startOffset: patternOffset ?? effectiveOffset,
        startWidth: patternWidth,
        mode,
      }
      if (mode === 'move' && patternOffset == null) {
        onPatternOffsetChange?.(effectiveOffset)
      }
      setDragging(true)
      e.preventDefault()
      e.stopPropagation()
    },
    [
      patternOffset,
      effectiveOffset,
      patternWidth,
      onPatternOffsetChange,
    ],
  )

  if (!bounds) return null
  const patternColor = patterns[0]?.color ?? '#8b5cf6'

  return (
    <>
      {/* Translucent band */}
      <div
        style={{
          position: 'absolute',
          left: bounds.left,
          top: bounds.top,
          width: bounds.right - bounds.left,
          height: bounds.height,
          background: `${patternColor}08`,
          borderLeft: `1px solid ${patternColor}30`,
          borderRight: `1px solid ${patternColor}30`,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />

      {/* Center drag area */}
      <div
        style={{
          position: 'absolute',
          left: bounds.left + 12,
          top: bounds.top,
          width: Math.max(0, bounds.right - bounds.left - 24),
          height: bounds.height,
          cursor: dragging && dragRef.current.mode === 'move' ? 'grabbing' : 'grab',
          zIndex: 11,
        }}
        onMouseDown={e => startDrag('move', e)}
      />

      {/* Left edge handle */}
      <div
        style={{
          position: 'absolute',
          left: bounds.left - 4,
          top: bounds.top,
          width: 12,
          height: bounds.height,
          cursor: 'ew-resize',
          zIndex: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseDown={e => startDrag('left', e)}
      >
        <div
          style={{
            width: 4,
            height: 40,
            borderRadius: 2,
            background: `${patternColor}60`,
            transition: 'background 0.15s',
          }}
          className="hover:!bg-white/60"
        />
      </div>

      {/* Right edge handle */}
      <div
        style={{
          position: 'absolute',
          left: bounds.right - 8,
          top: bounds.top,
          width: 12,
          height: bounds.height,
          cursor: 'ew-resize',
          zIndex: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseDown={e => startDrag('right', e)}
      >
        <div
          style={{
            width: 4,
            height: 40,
            borderRadius: 2,
            background: `${patternColor}60`,
            transition: 'background 0.15s',
          }}
          className="hover:!bg-white/60"
        />
      </div>

      {/* Score badge + reset */}
      <div
        className="absolute z-20 flex gap-1.5 items-center"
        style={{ left: bounds.left, top: bounds.top + 8 }}
      >
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white/90"
          style={{ background: `${patternColor}90` }}
        >
          {dragScore ?? '—'}%{patternWidth !== WINDOW && ` · ${patternWidth}봉`}
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
  )
}
