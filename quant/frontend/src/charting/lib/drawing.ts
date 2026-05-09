// charting/lib/drawing.ts
//
// 사용자 그리기 (현재: 가로선만, 후속에 추세선/측정도구) 의 데이터 모델 + localStorage IO.
// 자산별 (asset:market) 로 분리 저장.

export type DrawingKind = 'horizontal-line'

export interface HorizontalLineDrawing {
  kind: 'horizontal-line'
  id: string
  price: number
  color: string
  title?: string
  createdAt: number
}

export type Drawing = HorizontalLineDrawing

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
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `hl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    price,
    color,
    createdAt: Date.now(),
  }
}
