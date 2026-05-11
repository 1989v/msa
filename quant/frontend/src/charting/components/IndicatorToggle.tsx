// charting/frontend/src/components/IndicatorToggle.tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

export interface IndicatorParams {
  ma5Period: number
  ma20Period: number
  ma60Period: number
  ma120Period: number
  bbPeriod: number
  bbStdDev: number
  rsiPeriod: number
  stochasticK: number
  stochasticD: number
  stochasticSlowing: number
  williamsRPeriod: number
  atrPeriod: number
}

export const DEFAULT_PARAMS: IndicatorParams = {
  ma5Period: 5, ma20Period: 20, ma60Period: 60, ma120Period: 120,
  bbPeriod: 20, bbStdDev: 2,
  rsiPeriod: 14,
  stochasticK: 14, stochasticD: 3, stochasticSlowing: 3,
  williamsRPeriod: 14,
  atrPeriod: 14,
}

export interface Indicators {
  ma5: boolean
  ma20: boolean
  ma60: boolean
  ma120: boolean
  bb: boolean
  volume: boolean
  rsi: boolean
  macd: boolean
  stochastic: boolean
  williamsR: boolean
  atr: boolean
  obv: boolean
  vwap: boolean
}

interface Props {
  value: Indicators
  onChange: (next: Indicators) => void
  params: IndicatorParams
  onParamsChange: (next: IndicatorParams) => void
}

const TOOLTIPS: Record<keyof Indicators, string> = {
  ma5: '5일 단순이동평균. 단기 추세 확인에 사용.',
  ma20: '20일 단순이동평균. 중기 추세의 기준선.',
  ma60: '60일 단순이동평균. 분기 추세 확인.',
  ma120: '120일 단순이동평균. 반기 추세, 장기 지지/저항선 역할.',
  bb: '볼린저 밴드. 이동평균 ± 표준편차로 변동성 범위 표시. 밴드 수축 후 확장 시 큰 움직임 예상.',
  volume: '거래량. 가격 움직임의 신뢰도를 확인하는 기본 지표.',
  rsi: '상대강도지수(RSI). 70 이상 과매수, 30 이하 과매도. 추세 전환 신호로 활용.',
  macd: 'MACD(12,26,9). 단기·장기 이동평균 차이로 추세 방향과 강도를 측정. 시그널선 교차가 매매 신호.',
  stochastic: '스토캐스틱(K,D). 현재 가격이 일정 기간 가격 범위 내 어디에 있는지 표시. K가 D를 상향 돌파 시 매수 신호.',
  williamsR: '윌리엄스 %R. -20 이상 과매수, -80 이하 과매도. RSI와 유사하나 반전값으로 표시.',
  atr: '평균진폭(ATR). 가격 변동성을 측정. 값이 클수록 변동폭이 크며, 손절 폭 설정에 활용.',
  obv: '거래량균형(OBV). 거래량을 누적하여 자금 흐름을 추적. 가격과 OBV 방향이 다르면 추세 전환 신호.',
  vwap: '거래량가중평균가격(VWAP). 거래량을 고려한 평균가. 위에 있으면 강세, 아래면 약세.',
}

const BUTTONS: { key: keyof Indicators; label: string; color: string; paramKeys?: (keyof IndicatorParams)[] }[] = [
  { key: 'ma5', label: 'MA5', color: '#f59e0b', paramKeys: ['ma5Period'] },
  { key: 'ma20', label: 'MA20', color: '#3b82f6', paramKeys: ['ma20Period'] },
  { key: 'ma60', label: 'MA60', color: '#a855f7', paramKeys: ['ma60Period'] },
  { key: 'ma120', label: 'MA120', color: '#ec4899', paramKeys: ['ma120Period'] },
  { key: 'bb', label: 'BB', color: '#06b6d4', paramKeys: ['bbPeriod', 'bbStdDev'] },
  { key: 'volume', label: 'VOL', color: '#6b7280' },
  { key: 'rsi', label: 'RSI', color: '#10b981', paramKeys: ['rsiPeriod'] },
  { key: 'macd', label: 'MACD', color: '#ef4444' },
  { key: 'stochastic', label: 'STOCH', color: '#f472b6', paramKeys: ['stochasticK', 'stochasticD', 'stochasticSlowing'] },
  { key: 'williamsR', label: '%R', color: '#a78bfa', paramKeys: ['williamsRPeriod'] },
  { key: 'atr', label: 'ATR', color: '#fbbf24', paramKeys: ['atrPeriod'] },
  { key: 'obv', label: 'OBV', color: '#34d399' },
  { key: 'vwap', label: 'VWAP', color: '#60a5fa' },
]

const PARAM_LABELS: Record<string, string> = {
  ma5Period: '기간', ma20Period: '기간', ma60Period: '기간', ma120Period: '기간',
  bbPeriod: '기간', bbStdDev: '표준편차 배수',
  rsiPeriod: '기간',
  stochasticK: 'K 기간', stochasticD: 'D 기간', stochasticSlowing: '슬로잉',
  williamsRPeriod: '기간',
  atrPeriod: '기간',
}

export function IndicatorToggle({ value, onChange, params, onParamsChange }: Props) {
  const [editingKey, setEditingKey] = useState<keyof Indicators | null>(null)
  // 글로벌 hover tooltip — portal 로 빼서 popover panel 의 overflow clipping 회피.
  const [hovered, setHovered] = useState<{
    key: keyof Indicators
    rect: { left: number; right: number; top: number; bottom: number }
  } | null>(null)
  // Param popover anchor — editingKey 가 있을 때 버튼 rect 추적.
  const buttonRefs = useRef<Map<keyof Indicators, HTMLButtonElement>>(new Map())
  const [paramAnchor, setParamAnchor] = useState<DOMRect | null>(null)

  // editingKey 가 바뀌면 해당 버튼 rect 로 paramAnchor 갱신.
  useLayoutEffect(() => {
    if (!editingKey) {
      setParamAnchor(null)
      return
    }
    const el = buttonRefs.current.get(editingKey)
    if (el) setParamAnchor(el.getBoundingClientRect())
  }, [editingKey])

  // viewport resize/scroll 시 param popover 위치 재계산.
  useEffect(() => {
    if (!editingKey) return
    const recompute = () => {
      const el = buttonRefs.current.get(editingKey)
      if (el) setParamAnchor(el.getBoundingClientRect())
    }
    window.addEventListener('resize', recompute)
    window.addEventListener('scroll', recompute, true)
    return () => {
      window.removeEventListener('resize', recompute)
      window.removeEventListener('scroll', recompute, true)
    }
  }, [editingKey])

  const toggle = (key: keyof Indicators) =>
    onChange({ ...value, [key]: !value[key] })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {BUTTONS.map(({ key, label, color, paramKeys }) => {
          const active = value[key]
          return (
            <div key={key} className="relative">
              <button
                ref={el => {
                  if (el) buttonRefs.current.set(key, el)
                  else buttonRefs.current.delete(key)
                }}
                onClick={() => toggle(key)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  if (paramKeys) setEditingKey(editingKey === key ? null : key)
                }}
                onMouseEnter={e => {
                  const r = e.currentTarget.getBoundingClientRect()
                  setHovered({
                    key,
                    rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom },
                  })
                }}
                onMouseLeave={() => setHovered(prev => (prev?.key === key ? null : prev))}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full border transition-all duration-150 cursor-pointer ${
                  active
                    ? 'text-white'
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-400 hover:bg-slate-700/50'
                }`}
                style={active ? { background: color, borderColor: color, color: '#fff' } : undefined}
              >
                {label}
                {paramKeys && active && (
                  <span
                    className="ml-1 opacity-60 hover:opacity-100"
                    onClick={(e) => { e.stopPropagation(); setEditingKey(editingKey === key ? null : key) }}
                  >
                    ⚙
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Floating tooltip — portal, viewport-aware placement */}
      {hovered && (
        <FloatingTooltip
          rect={hovered.rect}
          text={TOOLTIPS[hovered.key]}
        />
      )}

      {/* Floating parameter popover — portal */}
      {editingKey && paramAnchor && (() => {
        const btn = BUTTONS.find(b => b.key === editingKey)
        if (!btn || !btn.paramKeys) return null
        return (
          <FloatingParamPopover
            anchorRect={paramAnchor}
            label={btn.label}
            paramKeys={btn.paramKeys}
            params={params}
            onParamsChange={onParamsChange}
            onClose={() => setEditingKey(null)}
          />
        )
      })()}
    </div>
  )
}

// ── Floating tooltip — portal to body + viewport-aware placement ──────────────
function FloatingTooltip({
  rect,
  text,
}: {
  rect: { left: number; right: number; top: number; bottom: number }
  text: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null)

  useLayoutEffect(() => {
    const tip = ref.current
    if (!tip) return
    const tipR = tip.getBoundingClientRect()
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    const cx = (rect.left + rect.right) / 2

    // 위쪽이 충분하면 top, 아니면 bottom
    const spaceAbove = rect.top
    const spaceBelow = vh - rect.bottom
    const placement: 'top' | 'bottom' =
      spaceAbove >= tipR.height + margin || spaceAbove > spaceBelow
        ? 'top'
        : 'bottom'

    const top =
      placement === 'top'
        ? Math.max(margin, rect.top - tipR.height - margin)
        : Math.min(vh - tipR.height - margin, rect.bottom + margin)

    // 좌우 — 가운데 정렬 후 viewport clamp
    let left = cx - tipR.width / 2
    if (left < margin) left = margin
    if (left + tipR.width > vw - margin) left = vw - tipR.width - margin

    setPos({ top, left, placement })
  }, [rect.left, rect.right, rect.top, rect.bottom])

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 10000,
        pointerEvents: 'none',
        opacity: pos ? 1 : 0,
        transition: 'opacity 80ms ease-out',
        width: 224,
        background: '#1e293b',
        border: '1px solid #475569',
        boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
      }}
      className="px-3 py-2 rounded-lg text-xs text-slate-300"
      role="tooltip"
    >
      <div className="flex items-start gap-1.5">
        <Info className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
        <span>{text}</span>
      </div>
    </div>,
    document.body,
  )
}

// ── Floating parameter popover — portal + viewport-aware ──────────────────────
function FloatingParamPopover({
  anchorRect,
  label,
  paramKeys,
  params,
  onParamsChange,
  onClose,
}: {
  anchorRect: DOMRect
  label: string
  paramKeys: (keyof IndicatorParams)[]
  params: IndicatorParams
  onParamsChange: (next: IndicatorParams) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight

    // 기본 아래쪽
    const spaceBelow = vh - anchorRect.bottom
    const placeBelow = spaceBelow >= r.height + margin || spaceBelow > anchorRect.top
    const top = placeBelow
      ? Math.min(vh - r.height - margin, anchorRect.bottom + 4)
      : Math.max(margin, anchorRect.top - r.height - 4)

    // 기본 anchor 좌측 정렬, viewport clamp
    let left = anchorRect.left
    if (left + r.width > vw - margin) left = vw - r.width - margin
    if (left < margin) left = margin

    setPos({ top, left })
  }, [anchorRect.left, anchorRect.right, anchorRect.top, anchorRect.bottom])

  // 외부 클릭/ESC 닫기
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      style={{
        position: 'fixed',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 10001,
        minWidth: 180,
        background: '#1e293b',
        border: '1px solid #475569',
        boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
      }}
      className="p-3 rounded-lg"
    >
      <p className="text-xs font-semibold text-slate-300 mb-2">{label} 설정</p>
      {paramKeys.map(pk => (
        <div key={pk} className="flex items-center justify-between gap-2 mb-1.5">
          <label className="text-xs text-slate-400">{PARAM_LABELS[pk]}</label>
          <input
            type="number"
            value={params[pk]}
            onChange={e => onParamsChange({ ...params, [pk]: Number(e.target.value) || 1 })}
            className="w-16 px-2 py-1 text-xs bg-slate-700 border border-slate-600 rounded text-white text-right"
            min={1}
            step={pk === 'bbStdDev' ? 0.5 : 1}
          />
        </div>
      ))}
      <button
        onClick={onClose}
        className="w-full mt-1 px-2 py-1 text-xs text-slate-400 hover:text-white bg-slate-700 rounded"
      >
        닫기
      </button>
    </div>,
    document.body,
  )
}
