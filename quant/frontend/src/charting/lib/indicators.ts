// charting/frontend/src/lib/indicators.ts

/** Simple Moving Average */
export function calcMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null
    return closes.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  })
}

export interface BBPoint { upper: number; mid: number; lower: number }

/** Bollinger Bands (MA20 ± numStdDev × σ) */
export function calcBollingerBands(closes: number[], period = 20, numStdDev = 2): (BBPoint | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null
    const slice = closes.slice(i - period + 1, i + 1)
    const ma = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + (b - ma) ** 2, 0) / period
    const std = Math.sqrt(variance)
    return { upper: ma + numStdDev * std, mid: ma, lower: ma - numStdDev * std }
  })
}

/** Wilder's RSI */
export function calcRSI(closes: number[], period = 14): (number | null)[] {
  if (closes.length < period + 1) return closes.map(() => null)
  const deltas = closes.slice(1).map((c, i) => c - closes[i])
  const result: (number | null)[] = Array(period + 1).fill(null)

  const initGains = deltas.slice(0, period).map(d => Math.max(d, 0))
  const initLosses = deltas.slice(0, period).map(d => Math.max(-d, 0))
  let avgGain = initGains.reduce((a, b) => a + b, 0) / period
  let avgLoss = initLosses.reduce((a, b) => a + b, 0) / period

  for (let i = period; i < deltas.length; i++) {
    avgGain = (avgGain * (period - 1) + Math.max(deltas[i], 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-deltas[i], 0)) / period
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss
    result.push(100 - 100 / (1 + rs))
  }
  return result
}

/** EMA (helper) */
function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out = [values[0]]
  for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k))
  return out
}

export interface MACDPoint { macd: number; signal: number; histogram: number }

/** MACD(fast, slow, signal) */
export function calcMACD(closes: number[], fast = 12, slow = 26, signalPeriod = 9): (MACDPoint | null)[] {
  if (closes.length < slow + signalPeriod) return closes.map(() => null)
  const ema12 = ema(closes, fast)
  const ema26 = ema(closes, slow)
  const macdLine = ema12.map((v, i) => v - ema26[i])
  const signalLine = ema(macdLine.slice(slow - 1), signalPeriod)

  return closes.map((_, i) => {
    if (i < slow - 1) return null
    const m = macdLine[i]
    const s = signalLine[i - (slow - 1)]
    if (s === undefined) return null
    return { macd: m, signal: s, histogram: m - s }
  })
}

/** Stochastic Oscillator (%K, %D) */
export function calcStochastic(
  highs: number[], lows: number[], closes: number[],
  kPeriod = 14, dPeriod = 3, slowing = 3
): { k: number | null; d: number | null }[] {
  const result: { k: number | null; d: number | null }[] = []
  const rawK: (number | null)[] = []

  for (let i = 0; i < closes.length; i++) {
    if (i < kPeriod - 1) { rawK.push(null); result.push({ k: null, d: null }); continue }
    const hh = Math.max(...highs.slice(i - kPeriod + 1, i + 1))
    const ll = Math.min(...lows.slice(i - kPeriod + 1, i + 1))
    rawK.push(hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100)
    result.push({ k: null, d: null })
  }

  // Slow %K (SMA of raw %K)
  for (let i = 0; i < rawK.length; i++) {
    if (i < kPeriod - 1 + slowing - 1) continue
    const slice = rawK.slice(i - slowing + 1, i + 1).filter(v => v !== null) as number[]
    if (slice.length === slowing) result[i].k = slice.reduce((a, b) => a + b) / slowing
  }

  // %D (SMA of %K)
  for (let i = 0; i < result.length; i++) {
    if (result[i].k === null) continue
    const kValues: number[] = []
    for (let j = Math.max(0, i - dPeriod + 1); j <= i; j++) {
      if (result[j].k !== null) kValues.push(result[j].k!)
    }
    if (kValues.length === dPeriod) result[i].d = kValues.reduce((a, b) => a + b) / dPeriod
  }

  return result
}

/** Williams %R */
export function calcWilliamsR(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  return closes.map((close, i) => {
    if (i < period - 1) return null
    const hh = Math.max(...highs.slice(i - period + 1, i + 1))
    const ll = Math.min(...lows.slice(i - period + 1, i + 1))
    return hh === ll ? -50 : ((hh - close) / (hh - ll)) * -100
  })
}

/** Average True Range */
export function calcATR(highs: number[], lows: number[], closes: number[], period = 14): (number | null)[] {
  const tr: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { tr.push(highs[i] - lows[i]); continue }
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])))
  }
  const result: (number | null)[] = []
  for (let i = 0; i < tr.length; i++) {
    if (i < period - 1) { result.push(null); continue }
    if (i === period - 1) { result.push(tr.slice(0, period).reduce((a, b) => a + b) / period); continue }
    result.push((result[i - 1]! * (period - 1) + tr[i]) / period)
  }
  return result
}

/** On-Balance Volume */
export function calcOBV(closes: number[], volumes: number[]): number[] {
  const obv: number[] = [0]
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv.push(obv[i - 1] + volumes[i])
    else if (closes[i] < closes[i - 1]) obv.push(obv[i - 1] - volumes[i])
    else obv.push(obv[i - 1])
  }
  return obv
}

/** Volume Weighted Average Price */
export function calcVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): (number | null)[] {
  let cumTPV = 0, cumVol = 0
  return closes.map((_, i) => {
    const tp = (highs[i] + lows[i] + closes[i]) / 3
    cumTPV += tp * volumes[i]
    cumVol += volumes[i]
    return cumVol === 0 ? null : cumTPV / cumVol
  })
}

// ─── Indicator metadata (TG-2-D) ─────────────────────────────────────────────

export type IndicatorKey =
  | 'ma5' | 'ma20' | 'ma60' | 'ma120'
  | 'bb' | 'vwap'
  | 'volume'
  | 'rsi' | 'stochastic' | 'williamsR' | 'atr'
  | 'macd' | 'obv'

/**
 * Logical pane group for indicators. Caller (PatternChart) maps to numeric paneIndex:
 *
 * - `overlay`     → paneIndex 0 (메인 가격 차트 위 overlay) — MA·BB·VWAP
 * - `volume`      → paneIndex 1+ (volume 활성 시 첫 sub-pane) — Volume
 * - `oscillator`  → paneIndex N (활성 순서대로 다음 빈 pane) — RSI / Stoch / Williams%R / ATR
 * - `momentum`    → paneIndex N — MACD / OBV
 *
 * 동적 할당 이유: 사용자가 활성화한 sub-pane 만 화면에 표시 (비활성은 paneIndex 미점유).
 */
export type IndicatorPaneGroup = 'overlay' | 'volume' | 'oscillator' | 'momentum'

export interface IndicatorMeta {
  /** Short label for UI buttons / tooltips. */
  label: string
  /** Logical pane group. */
  paneGroup: IndicatorPaneGroup
  /** Default color (hex). For multi-line indicators (MACD/Stoch), `secondaryColor` 도 함께. */
  color: string
  secondaryColor?: string
}

/**
 * Single source of truth for indicator metadata. PatternChart / IndicatorPopover 가
 * 메타에서 color, label, paneGroup 을 가져와 사용한다.
 *
 * 색상은 한국 시세 관습과 분리된 보조 지표 팔레트 — 시세 색(--ko-quote-*) 와 충돌 X.
 */
export const INDICATOR_META: Record<IndicatorKey, IndicatorMeta> = {
  ma5:        { label: 'MA5',        paneGroup: 'overlay',    color: '#f59e0b' },
  ma20:       { label: 'MA20',       paneGroup: 'overlay',    color: '#3b82f6' },
  ma60:       { label: 'MA60',       paneGroup: 'overlay',    color: '#a855f7' },
  ma120:      { label: 'MA120',      paneGroup: 'overlay',    color: '#ec4899' },
  bb:         { label: 'BB',         paneGroup: 'overlay',    color: '#06b6d4' },
  vwap:       { label: 'VWAP',       paneGroup: 'overlay',    color: '#60a5fa' },
  volume:     { label: 'Volume',     paneGroup: 'volume',     color: '#6b7280' },
  rsi:        { label: 'RSI',        paneGroup: 'oscillator', color: '#8b5cf6' },
  stochastic: { label: 'Stoch',      paneGroup: 'oscillator', color: '#3b82f6', secondaryColor: '#ef4444' },
  williamsR:  { label: '%R',         paneGroup: 'oscillator', color: '#a78bfa' },
  atr:        { label: 'ATR',        paneGroup: 'oscillator', color: '#fbbf24' },
  macd:       { label: 'MACD',       paneGroup: 'momentum',   color: '#3b82f6', secondaryColor: '#ef4444' },
  obv:        { label: 'OBV',        paneGroup: 'momentum',   color: '#34d399' },
}

/** Active indicator keys → ordered list of sub-pane keys (deterministic).
 *  paneIndex 0 은 메인 — 여기서 반환되는 키들이 순서대로 paneIndex 1, 2, 3, ... 차지.
 *  groupOrder 로 안정적 순서 보장. */
export function activeSubPaneKeys(active: Partial<Record<IndicatorKey, boolean>>): IndicatorKey[] {
  // 'volume' first, then oscillators, then momentum — visual hierarchy.
  const groupOrder: IndicatorPaneGroup[] = ['volume', 'oscillator', 'momentum']
  const keys: IndicatorKey[] = []
  for (const group of groupOrder) {
    for (const key of Object.keys(INDICATOR_META) as IndicatorKey[]) {
      if (INDICATOR_META[key].paneGroup === group && active[key]) keys.push(key)
    }
  }
  return keys
}
