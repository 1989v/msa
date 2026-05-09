// charting/lib/drawing.ts
//
// 사용자 그리기 (현재: 가로선만, 후속에 추세선/측정도구) 의 데이터 모델 + localStorage IO.
// 자산별 (asset:market) 로 분리 저장.

export type DrawingKind = 'horizontal-line' | 'trend-line' | 'measure'

export interface HorizontalLineDrawing {
  kind: 'horizontal-line'
  id: string
  price: number
  color: string
  title?: string
  createdAt: number
}

/**
 * 추세선 — 두 점 (date, price) 기반 직선.
 * Phase A prototype: 최근 N봉 close 의 선형 회귀로 자동 생성 (직접 클릭은 후속).
 */
export interface TrendLineDrawing {
  kind: 'trend-line'
  id: string
  /** ISO date or epoch ms (UTC), 시작점. */
  startTime: string | number
  startPrice: number
  endTime: string | number
  endPrice: number
  color: string
  title?: string
  createdAt: number
}

/**
 * 측정도구 — 두 점 사이의 가격 변동률 + 시간 간격을 표시.
 * Phase A: 두 점 line + 가격 변동% 라벨 (시간 간격은 후속).
 */
export interface MeasureDrawing {
  kind: 'measure'
  id: string
  startTime: string | number
  startPrice: number
  endTime: string | number
  endPrice: number
  color: string
  createdAt: number
}

export type Drawing = HorizontalLineDrawing | TrendLineDrawing | MeasureDrawing

const STORAGE_KEY = 'quant:drawings:v1'

interface PersistedState {
  [assetKey: string]: Drawing[]
}

function safeRead(): PersistedState {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
    if (!raw) return {}
    const parsed = JSON.parse(raw) as PersistedState
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function safeWrite(state: PersistedState): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore quota / disabled storage */
  }
}

export function makeAssetKey(asset: string, market: string): string {
  return `${asset}:${market}`
}

export function listFor(assetKey: string): Drawing[] {
  return safeRead()[assetKey] ?? []
}

export function addDrawing(assetKey: string, drawing: Drawing): void {
  const state = safeRead()
  state[assetKey] = [...(state[assetKey] ?? []), drawing]
  safeWrite(state)
}

export function removeDrawing(assetKey: string, id: string): void {
  const state = safeRead()
  state[assetKey] = (state[assetKey] ?? []).filter(d => d.id !== id)
  if (state[assetKey].length === 0) delete state[assetKey]
  safeWrite(state)
}

export function clearDrawings(assetKey: string): void {
  const state = safeRead()
  delete state[assetKey]
  safeWrite(state)
}

export function makeHorizontalLine(price: number, color: string): HorizontalLineDrawing {
  return {
    kind: 'horizontal-line',
    id: makeId('hl'),
    price,
    color,
    createdAt: Date.now(),
  }
}

export function makeTrendLine(
  startTime: string | number,
  startPrice: number,
  endTime: string | number,
  endPrice: number,
  color: string,
): TrendLineDrawing {
  return {
    kind: 'trend-line',
    id: makeId('tl'),
    startTime,
    startPrice,
    endTime,
    endPrice,
    color,
    createdAt: Date.now(),
  }
}

export function makeMeasure(
  startTime: string | number,
  startPrice: number,
  endTime: string | number,
  endPrice: number,
  color: string,
): MeasureDrawing {
  return {
    kind: 'measure',
    id: makeId('ms'),
    startTime,
    startPrice,
    endTime,
    endPrice,
    color,
    createdAt: Date.now(),
  }
}

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Linear regression 으로 N 데이터 포인트의 회귀선 두 끝점 반환.
 * y = a + b*x — least squares.
 */
export function regressionEndpoints(
  points: Array<{ x: number; y: number }>,
): { startX: number; startY: number; endX: number; endY: number } | null {
  if (points.length < 2) return null
  const n = points.length
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0)
  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return null
  const b = (n * sumXY - sumX * sumY) / denom
  const a = (sumY - b * sumX) / n
  const xs = points.map(p => p.x)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  return {
    startX: xMin,
    startY: a + b * xMin,
    endX: xMax,
    endY: a + b * xMax,
  }
}
