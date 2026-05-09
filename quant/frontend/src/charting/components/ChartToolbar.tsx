// charting/components/ChartToolbar.tsx
//
// 도구바 — 차트모양 / 보조지표 / 그리기(disabled, P2) / 종목비교(disabled, P2) / 크게보기.
// IndicatorPopover 통해 지표 토글 + 파라미터 편집.
import { useEffect, useRef, useState } from 'react'
import {
  CandlestickChart,
  LineChart,
  AreaChart,
  Activity,
  Maximize2,
  PencilLine,
  GitCompare,
} from 'lucide-react'
import type { ChartType } from '../types'
import { CHART_TYPES } from '../types'
import { IndicatorPopover } from './IndicatorPopover'
import type { Indicators, IndicatorParams } from './IndicatorToggle'
import { cn } from '@/lib/cn'

interface Props {
  chartType: ChartType
  onChartTypeChange: (type: ChartType) => void
  onFullscreen: () => void
  /** Optional — 지표 popover 활성. 미제공 시 popover 미노출. */
  indicators?: Indicators
  onIndicatorsChange?: (next: Indicators) => void
  indicatorParams?: IndicatorParams
  onIndicatorParamsChange?: (next: IndicatorParams) => void
  /** TG-12 종목비교 — 활성 비교 종목 라벨. 미제공 시 비교 비활성. */
  compareLabel?: string | null
  /** 비교 종목 추가/변경 클릭 — caller 가 SymbolPickerSheet 등 노출. */
  onCompareClick?: () => void
  /** 비교 해제 — null state 로 reset. */
  onCompareClear?: () => void
  /** TG-11 그리기 — 가로선 추가 (현재 종가 기준). 미제공 시 그리기 비활성. */
  onAddHorizontalLine?: () => void
  /** 추세선 자동 추가 (최근 N봉 close 회귀선). 미제공 시 추세선 메뉴 hide. */
  onAddTrendLine?: () => void
  /** 추세선 직접 그리기 모드 시작 (두 점 클릭). */
  onStartTrendLineDraw?: () => void
  /** 측정도구 모드 시작 (두 점 클릭). */
  onStartMeasureDraw?: () => void
  onClearDrawings?: () => void
  drawingCount?: number
  /** 활성 drawing mode 라벨 — 표시용 (예: '추세선: 시작점 클릭'). */
  drawingModeLabel?: string | null
  className?: string
}

const CHART_TYPE_ICON: Record<ChartType, typeof CandlestickChart> = {
  candle: CandlestickChart,
  heikinashi: Activity,
  line: LineChart,
  area: AreaChart,
}

export function ChartToolbar({
  chartType,
  onChartTypeChange,
  onFullscreen,
  indicators,
  onIndicatorsChange,
  indicatorParams,
  onIndicatorParamsChange,
  compareLabel,
  onCompareClick,
  onCompareClear,
  onAddHorizontalLine,
  onAddTrendLine,
  onStartTrendLineDraw,
  onStartMeasureDraw,
  onClearDrawings,
  drawingCount = 0,
  drawingModeLabel,
  className,
}: Props) {
  const showIndicatorPopover =
    !!indicators && !!onIndicatorsChange && !!indicatorParams && !!onIndicatorParamsChange
  const compareActive = !!compareLabel

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <ChartTypeMenu chartType={chartType} onChartTypeChange={onChartTypeChange} />

      {showIndicatorPopover && (
        <IndicatorPopover
          value={indicators}
          onChange={onIndicatorsChange}
          params={indicatorParams}
          onParamsChange={onIndicatorParamsChange}
        />
      )}

      {/* 그리기 (TG-11) */}
      {onAddHorizontalLine ? (
        <DrawingMenu
          onAddHorizontalLine={onAddHorizontalLine}
          onAddTrendLine={onAddTrendLine}
          onStartTrendLineDraw={onStartTrendLineDraw}
          onStartMeasureDraw={onStartMeasureDraw}
          onClearDrawings={onClearDrawings}
          drawingCount={drawingCount}
          drawingModeLabel={drawingModeLabel}
        />
      ) : (
        <ToolButton
          icon={PencilLine}
          label="그리기"
          title="그리기 도구"
          disabled
        />
      )}

      {/* 종목비교 (TG-12) */}
      {onCompareClick ? (
        <button
          type="button"
          onClick={onCompareClick}
          aria-label="종목비교"
          title={compareActive ? `비교 중: ${compareLabel}` : '종목비교'}
          className="px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors"
          style={{
            background: compareActive
              ? 'color-mix(in oklch, var(--ko-accent-secondary) 22%, transparent)'
              : 'color-mix(in oklch, var(--ko-surface-2) 60%, transparent)',
            border: compareActive
              ? '1px solid color-mix(in oklch, var(--ko-accent-secondary) 40%, transparent)'
              : '1px solid var(--ko-border-subtle)',
            color: compareActive
              ? 'var(--ko-accent-secondary)'
              : 'var(--ko-text-secondary)',
          }}
        >
          <GitCompare className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden md:inline">
            {compareActive ? compareLabel : '비교'}
          </span>
          {compareActive && onCompareClear && (
            <span
              role="button"
              tabIndex={0}
              aria-label="비교 해제"
              onClick={e => {
                e.stopPropagation()
                onCompareClear()
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  onCompareClear()
                }
              }}
              className="ml-0.5 text-[10px] px-1 rounded cursor-pointer"
              style={{
                background:
                  'color-mix(in oklch, var(--ko-accent-secondary) 30%, transparent)',
              }}
            >
              ✕
            </span>
          )}
        </button>
      ) : (
        <ToolButton
          icon={GitCompare}
          label="비교"
          title="종목비교"
          disabled
        />
      )}

      {/* 크게보기 */}
      <ToolButton
        icon={Maximize2}
        label="크게"
        title="전체화면"
        onClick={onFullscreen}
      />
    </div>
  )
}

// ── ChartType menu (popover) ────────────────────────────────────────────────

function ChartTypeMenu({
  chartType,
  onChartTypeChange,
}: {
  chartType: ChartType
  onChartTypeChange: (t: ChartType) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const ActiveIcon = CHART_TYPE_ICON[chartType]
  const activeLabel = CHART_TYPES.find(t => t.value === chartType)?.label ?? chartType

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors"
        style={{
          background: open
            ? 'color-mix(in oklch, var(--ko-accent-primary) 22%, transparent)'
            : 'color-mix(in oklch, var(--ko-surface-2) 60%, transparent)',
          border: `1px solid ${
            open
              ? 'color-mix(in oklch, var(--ko-accent-primary) 40%, transparent)'
              : 'var(--ko-border-subtle)'
          }`,
          color: open
            ? 'var(--ko-accent-primary-hover)'
            : 'var(--ko-text-secondary)',
        }}
        title="차트 모양"
      >
        <ActiveIcon className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">{activeLabel}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 z-30 w-[160px] rounded-xl shadow-lg p-1"
          style={{
            background: 'var(--ko-surface-1)',
            border: '1px solid var(--ko-border-subtle)',
          }}
        >
          {CHART_TYPES.map(({ value, label }) => {
            const Icon = CHART_TYPE_ICON[value]
            const active = value === chartType
            return (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  onChartTypeChange(value)
                  setOpen(false)
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg transition-colors"
                style={{
                  background: active
                    ? 'color-mix(in oklch, var(--ko-accent-primary) 18%, transparent)'
                    : 'transparent',
                  color: active
                    ? 'var(--ko-accent-primary-hover)'
                    : 'var(--ko-text-secondary)',
                }}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Drawing menu ────────────────────────────────────────────────────────────

function DrawingMenu({
  onAddHorizontalLine,
  onAddTrendLine,
  onStartTrendLineDraw,
  onStartMeasureDraw,
  onClearDrawings,
  drawingCount,
  drawingModeLabel,
}: {
  onAddHorizontalLine: () => void
  onAddTrendLine?: () => void
  onStartTrendLineDraw?: () => void
  onStartMeasureDraw?: () => void
  onClearDrawings?: () => void
  drawingCount: number
  drawingModeLabel?: string | null
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors"
        style={{
          background: open
            ? 'color-mix(in oklch, var(--ko-accent-primary) 22%, transparent)'
            : 'color-mix(in oklch, var(--ko-surface-2) 60%, transparent)',
          border: `1px solid ${
            open
              ? 'color-mix(in oklch, var(--ko-accent-primary) 40%, transparent)'
              : 'var(--ko-border-subtle)'
          }`,
          color: open
            ? 'var(--ko-accent-primary-hover)'
            : 'var(--ko-text-secondary)',
        }}
        title="그리기"
      >
        <PencilLine className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="hidden md:inline">그리기</span>
        {drawingCount > 0 && (
          <span
            className="ml-0.5 text-[10px] px-1 rounded tabular-nums"
            style={{
              background:
                'color-mix(in oklch, var(--ko-accent-primary) 30%, transparent)',
              color: 'var(--ko-accent-primary-hover)',
            }}
          >
            {drawingCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 z-30 w-[200px] rounded-xl shadow-lg p-1"
          style={{
            background: 'var(--ko-surface-1)',
            border: '1px solid var(--ko-border-subtle)',
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onAddHorizontalLine()
              setOpen(false)
            }}
            className="w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors hover:brightness-110"
            style={{
              color: 'var(--ko-text-secondary)',
              background: 'transparent',
            }}
          >
            가로선 추가 <span style={{ color: 'var(--ko-text-muted)' }}>(현재 종가)</span>
          </button>
          {onAddTrendLine && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onAddTrendLine()
                setOpen(false)
              }}
              className="w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors hover:brightness-110"
              style={{
                color: 'var(--ko-text-secondary)',
                background: 'transparent',
              }}
            >
              추세선 자동 추가 <span style={{ color: 'var(--ko-text-muted)' }}>(최근 30봉 회귀)</span>
            </button>
          )}
          {onStartTrendLineDraw && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onStartTrendLineDraw()
                setOpen(false)
              }}
              className="w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors hover:brightness-110"
              style={{
                color: 'var(--ko-text-secondary)',
                background: 'transparent',
              }}
            >
              추세선 그리기 <span style={{ color: 'var(--ko-text-muted)' }}>(두 점 클릭)</span>
            </button>
          )}
          {onStartMeasureDraw && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onStartMeasureDraw()
                setOpen(false)
              }}
              className="w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors hover:brightness-110"
              style={{
                color: 'var(--ko-text-secondary)',
                background: 'transparent',
              }}
            >
              측정도구 <span style={{ color: 'var(--ko-text-muted)' }}>(두 점 클릭)</span>
            </button>
          )}
          {drawingModeLabel && (
            <div
              className="px-2.5 py-1.5 text-[11px] rounded"
              style={{
                color: 'var(--ko-accent-primary-hover)',
                background: 'color-mix(in oklch, var(--ko-accent-primary) 14%, transparent)',
              }}
            >
              {drawingModeLabel}
            </div>
          )}
          {onClearDrawings && drawingCount > 0 && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onClearDrawings()
                setOpen(false)
              }}
              className="w-full text-left text-xs px-2.5 py-2 rounded-lg transition-colors hover:brightness-110"
              style={{
                color: 'var(--ko-status-loss)',
                background: 'transparent',
              }}
            >
              전체 지우기 ({drawingCount})
            </button>
          )}
          <div
            className="text-[10px] px-2.5 py-1.5"
            style={{ color: 'var(--ko-text-muted)' }}
          >
            추세선·측정도구는 후속 PR
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tool button ─────────────────────────────────────────────────────────────

function ToolButton({
  icon: Icon,
  label,
  title,
  onClick,
  disabled,
}: {
  icon: typeof CandlestickChart
  label: string
  title: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
      className={cn(
        'px-2 py-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors',
        disabled && 'cursor-not-allowed',
      )}
      style={{
        background: 'color-mix(in oklch, var(--ko-surface-2) 60%, transparent)',
        border: '1px solid var(--ko-border-subtle)',
        color: disabled ? 'var(--ko-text-disabled)' : 'var(--ko-text-secondary)',
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}
