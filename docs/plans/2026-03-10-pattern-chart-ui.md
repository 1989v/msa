# Pattern Chart UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** lightweight-charts 기반 전문 캔들스틱 차트에 10종 패턴 오버레이 + 기술 지표 토글 + 미래 추세 투영을 제공하는 UI로 프론트엔드를 전면 재구성한다.

**Architecture:** 패턴 라이브러리·매칭·지표 계산은 모두 클라이언트 사이드(추가 API 없음). Lightweight Charts를 직접 DOM 조작 방식으로 사용하며, 메인 차트(캔들+오버레이)와 서브 차트(Volume/RSI/MACD)를 개별 컴포넌트로 분리해 토글 시 마운트/언마운트한다. 시간축 동기화는 `subscribeVisibleLogicalRangeChange`로 처리.

**Tech Stack:** lightweight-charts ^4.2, React 18, TypeScript, date-fns (기존)

---

## Task 1: Install lightweight-charts

**Files:**
- Modify: `charting/frontend/package.json`

**Step 1: Add dependency**

```bash
cd /Users/gideok-kwon/IdeaProjects/feature-CHARTING/charting/frontend
npm install lightweight-charts@^4.2
```

**Step 2: Verify import works**

```bash
node -e "const lc = require('./node_modules/lightweight-charts/dist/lightweight-charts.standalone.development.js'); console.log('ok')"
```

Expected: `ok`

**Step 3: Commit**

```bash
git add charting/frontend/package.json charting/frontend/package-lock.json
git commit -m "feat(frontend): install lightweight-charts"
```

---

## Task 2: Create `src/lib/patterns.ts`

**Files:**
- Create: `charting/frontend/src/lib/patterns.ts`

**Step 1: Create file with all 10 patterns**

```typescript
// charting/frontend/src/lib/patterns.ts

export type Signal = 'bullish' | 'bearish' | 'neutral'

export interface PatternPoint {
  x: number  // 0..1 (normalized time: 0=window start, 1=window end)
  y: number  // 0..1 (normalized price: 0=window low, 1=window high)
}

export interface PatternDefinition {
  id: string
  name: string
  signal: Signal
  color: string
  description: string
  keyPoints: string[]
  curve: PatternPoint[]       // x: 0.0 → 1.0
  projection: PatternPoint[]  // x: 1.0 → ~1.33  (20 future days / 60 window days)
}

export const PATTERNS: PatternDefinition[] = [
  {
    id: 'elliott_impulse',
    name: 'Elliott Wave 5파동',
    signal: 'neutral',
    color: '#8b5cf6',
    description: '5파동 상승 임펄스 완성 단계. 패턴 완성 후 ABC 3파동 조정이 예상됩니다.',
    keyPoints: ['Wave 1 초기 상승', 'Wave 2 조정 (38-62%)', 'Wave 3 최강 상승 (1.618×)', 'Wave 4 완만한 조정', 'Wave 5 마지막 상승', '→ ABC 조정 시작'],
    curve: [
      { x: 0.00, y: 0.30 }, { x: 0.13, y: 0.58 }, { x: 0.22, y: 0.44 },
      { x: 0.42, y: 0.88 }, { x: 0.55, y: 0.65 }, { x: 0.72, y: 0.83 },
      { x: 0.82, y: 0.78 }, { x: 1.00, y: 0.72 },
    ],
    projection: [
      { x: 1.00, y: 0.72 }, { x: 1.05, y: 0.62 }, { x: 1.12, y: 0.50 },
      { x: 1.17, y: 0.55 }, { x: 1.25, y: 0.44 }, { x: 1.33, y: 0.38 },
    ],
  },
  {
    id: 'head_shoulders',
    name: 'Head & Shoulders',
    signal: 'bearish',
    color: '#ef4444',
    description: '상승 추세 종료 후 나타나는 하락반전 패턴. 목선(Neckline) 이탈 시 강한 하락이 예상됩니다.',
    keyPoints: ['왼쪽 어깨 (Left Shoulder)', '목선 (Neckline)', '헤드 (최고점)', '목선 재터치', '오른쪽 어깨 (Left < Right)', '→ 목선 이탈 하락'],
    curve: [
      { x: 0.00, y: 0.42 }, { x: 0.17, y: 0.70 }, { x: 0.27, y: 0.55 },
      { x: 0.45, y: 0.92 }, { x: 0.60, y: 0.55 }, { x: 0.74, y: 0.68 },
      { x: 0.85, y: 0.57 }, { x: 1.00, y: 0.54 },
    ],
    projection: [
      { x: 1.00, y: 0.54 }, { x: 1.07, y: 0.44 }, { x: 1.14, y: 0.32 },
      { x: 1.22, y: 0.22 }, { x: 1.33, y: 0.18 },
    ],
  },
  {
    id: 'inverse_head_shoulders',
    name: 'Inverse H&S',
    signal: 'bullish',
    color: '#10b981',
    description: '하락 추세 종료 후 나타나는 상승반전 패턴. 목선 돌파 시 강한 상승이 예상됩니다.',
    keyPoints: ['왼쪽 어깨 (바닥)', '목선', '헤드 (최저점)', '목선 재터치', '오른쪽 어깨', '→ 목선 돌파 상승'],
    curve: [
      { x: 0.00, y: 0.58 }, { x: 0.17, y: 0.30 }, { x: 0.27, y: 0.45 },
      { x: 0.45, y: 0.08 }, { x: 0.60, y: 0.45 }, { x: 0.74, y: 0.32 },
      { x: 0.85, y: 0.43 }, { x: 1.00, y: 0.46 },
    ],
    projection: [
      { x: 1.00, y: 0.46 }, { x: 1.08, y: 0.58 }, { x: 1.15, y: 0.68 },
      { x: 1.22, y: 0.78 }, { x: 1.33, y: 0.85 },
    ],
  },
  {
    id: 'double_top',
    name: 'Double Top',
    signal: 'bearish',
    color: '#f97316',
    description: '저항선에서 두 번 고점을 형성하는 하락반전(M자형) 패턴. 목선 이탈 후 하락 가속.',
    keyPoints: ['1차 고점 형성', '목선까지 하락', '2차 고점 (1차보다 낮음)', '목선 재터치', '→ 목선 이탈 하락'],
    curve: [
      { x: 0.00, y: 0.30 }, { x: 0.22, y: 0.82 }, { x: 0.35, y: 0.58 },
      { x: 0.50, y: 0.52 }, { x: 0.62, y: 0.78 }, { x: 0.73, y: 0.65 },
      { x: 0.85, y: 0.55 }, { x: 1.00, y: 0.53 },
    ],
    projection: [
      { x: 1.00, y: 0.53 }, { x: 1.07, y: 0.42 }, { x: 1.14, y: 0.30 },
      { x: 1.22, y: 0.22 }, { x: 1.33, y: 0.18 },
    ],
  },
  {
    id: 'double_bottom',
    name: 'Double Bottom',
    signal: 'bullish',
    color: '#3b82f6',
    description: '지지선에서 두 번 저점을 형성하는 상승반전(W자형) 패턴. 목선 돌파 후 강한 상승.',
    keyPoints: ['1차 저점 형성', '목선까지 반등', '2차 저점 (1차와 유사)', '목선 재터치', '→ 목선 돌파 상승'],
    curve: [
      { x: 0.00, y: 0.72 }, { x: 0.18, y: 0.25 }, { x: 0.30, y: 0.42 },
      { x: 0.42, y: 0.55 }, { x: 0.50, y: 0.48 }, { x: 0.65, y: 0.22 },
      { x: 0.78, y: 0.40 }, { x: 0.88, y: 0.55 }, { x: 1.00, y: 0.60 },
    ],
    projection: [
      { x: 1.00, y: 0.60 }, { x: 1.07, y: 0.70 }, { x: 1.15, y: 0.80 },
      { x: 1.23, y: 0.88 }, { x: 1.33, y: 0.95 },
    ],
  },
  {
    id: 'cup_handle',
    name: 'Cup & Handle',
    signal: 'bullish',
    color: '#06b6d4',
    description: 'U자형 컵 + 소폭 하락(핸들) 후 이전 고점 돌파하는 상승지속 패턴.',
    keyPoints: ['왼쪽 림 (고점)', 'U자형 컵 바닥', '오른쪽 림 (이전 고점 근접)', '핸들 소폭 하락', '→ 림 돌파 상승'],
    curve: [
      { x: 0.00, y: 0.80 }, { x: 0.10, y: 0.70 }, { x: 0.20, y: 0.55 },
      { x: 0.32, y: 0.38 }, { x: 0.45, y: 0.28 }, { x: 0.58, y: 0.35 },
      { x: 0.70, y: 0.52 }, { x: 0.80, y: 0.72 }, { x: 0.87, y: 0.65 },
      { x: 0.92, y: 0.60 }, { x: 0.96, y: 0.65 }, { x: 1.00, y: 0.70 },
    ],
    projection: [
      { x: 1.00, y: 0.70 }, { x: 1.08, y: 0.82 }, { x: 1.16, y: 0.92 },
      { x: 1.25, y: 1.00 }, { x: 1.33, y: 1.06 },
    ],
  },
  {
    id: 'ascending_triangle',
    name: 'Ascending Triangle',
    signal: 'bullish',
    color: '#84cc16',
    description: '수평 저항선 + 상승하는 지지선. 매번 저점이 높아지며 돌파 시 강한 상승.',
    keyPoints: ['수평 저항선 (여러 번 터치)', '상승하는 저점들', '거래량 감소 중 수렴', '→ 저항선 돌파 상승'],
    curve: [
      { x: 0.00, y: 0.45 }, { x: 0.08, y: 0.80 }, { x: 0.16, y: 0.58 },
      { x: 0.25, y: 0.82 }, { x: 0.33, y: 0.63 }, { x: 0.42, y: 0.83 },
      { x: 0.50, y: 0.67 }, { x: 0.60, y: 0.84 }, { x: 0.68, y: 0.71 },
      { x: 0.78, y: 0.85 }, { x: 0.86, y: 0.74 }, { x: 1.00, y: 0.83 },
    ],
    projection: [
      { x: 1.00, y: 0.83 }, { x: 1.07, y: 0.92 }, { x: 1.15, y: 1.00 },
      { x: 1.25, y: 1.08 }, { x: 1.33, y: 1.12 },
    ],
  },
  {
    id: 'descending_triangle',
    name: 'Descending Triangle',
    signal: 'bearish',
    color: '#dc2626',
    description: '수평 지지선 + 하락하는 저항선. 매번 고점이 낮아지며 이탈 시 강한 하락.',
    keyPoints: ['수평 지지선 (여러 번 터치)', '하락하는 고점들', '수렴 후 지지선 이탈', '→ 지지선 이탈 하락'],
    curve: [
      { x: 0.00, y: 0.82 }, { x: 0.08, y: 0.30 }, { x: 0.16, y: 0.62 },
      { x: 0.25, y: 0.30 }, { x: 0.33, y: 0.55 }, { x: 0.42, y: 0.28 },
      { x: 0.50, y: 0.48 }, { x: 0.60, y: 0.27 }, { x: 0.68, y: 0.42 },
      { x: 0.78, y: 0.25 }, { x: 0.88, y: 0.38 }, { x: 1.00, y: 0.24 },
    ],
    projection: [
      { x: 1.00, y: 0.24 }, { x: 1.08, y: 0.16 }, { x: 1.16, y: 0.08 },
      { x: 1.25, y: 0.04 }, { x: 1.33, y: 0.06 },
    ],
  },
  {
    id: 'bull_flag',
    name: 'Bull Flag',
    signal: 'bullish',
    color: '#22c55e',
    description: '급등(폴) 후 완만한 하락채널(깃발). 상승 추세의 일시적 조정 후 동일 폭 추가 상승.',
    keyPoints: ['폴 (급격한 상승)', '깃발 (완만한 하락채널)', '채널 내 거래량 감소', '→ 채널 상단 이탈, 폴 높이만큼 상승'],
    curve: [
      { x: 0.00, y: 0.10 }, { x: 0.05, y: 0.20 }, { x: 0.12, y: 0.52 },
      { x: 0.20, y: 0.80 }, { x: 0.28, y: 0.74 }, { x: 0.35, y: 0.68 },
      { x: 0.42, y: 0.62 }, { x: 0.50, y: 0.56 }, { x: 0.58, y: 0.50 },
      { x: 0.65, y: 0.44 }, { x: 0.73, y: 0.40 }, { x: 0.80, y: 0.36 },
      { x: 0.88, y: 0.33 }, { x: 1.00, y: 0.30 },
    ],
    projection: [
      { x: 1.00, y: 0.30 }, { x: 1.07, y: 0.45 }, { x: 1.14, y: 0.62 },
      { x: 1.22, y: 0.78 }, { x: 1.33, y: 0.90 },
    ],
  },
  {
    id: 'bear_flag',
    name: 'Bear Flag',
    signal: 'bearish',
    color: '#f43f5e',
    description: '급락(폴) 후 완만한 상승채널(깃발). 하락 추세의 일시적 반등 후 동일 폭 추가 하락.',
    keyPoints: ['폴 (급격한 하락)', '깃발 (완만한 상승채널)', '채널 내 거래량 감소', '→ 채널 하단 이탈, 폴 높이만큼 하락'],
    curve: [
      { x: 0.00, y: 0.90 }, { x: 0.07, y: 0.78 }, { x: 0.14, y: 0.55 },
      { x: 0.22, y: 0.28 }, { x: 0.30, y: 0.35 }, { x: 0.38, y: 0.42 },
      { x: 0.46, y: 0.48 }, { x: 0.54, y: 0.52 }, { x: 0.62, y: 0.55 },
      { x: 0.70, y: 0.58 }, { x: 0.78, y: 0.60 }, { x: 0.85, y: 0.62 },
      { x: 0.92, y: 0.63 }, { x: 1.00, y: 0.63 },
    ],
    projection: [
      { x: 1.00, y: 0.63 }, { x: 1.07, y: 0.52 }, { x: 1.14, y: 0.38 },
      { x: 1.22, y: 0.25 }, { x: 1.33, y: 0.15 },
    ],
  },
]
```

**Step 2: Commit**

```bash
git add charting/frontend/src/lib/patterns.ts
git commit -m "feat(frontend): add 10 chart pattern definitions"
```

---

## Task 3: Create `src/lib/patternMatcher.ts`

**Files:**
- Create: `charting/frontend/src/lib/patternMatcher.ts`

**Step 1: Write file**

```typescript
// charting/frontend/src/lib/patternMatcher.ts
import type { PatternDefinition, PatternPoint } from './patterns'

/** 희소 키포인트를 n개의 균등 간격 샘플로 선형 보간 */
export function interpolatePattern(points: PatternPoint[], n: number): number[] {
  const result: number[] = []
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1)
    let lo = 0
    while (lo < points.length - 2 && points[lo + 1].x <= x) lo++
    const a = points[lo], b = points[lo + 1]
    const t = a.x === b.x ? 0 : (x - a.x) / (b.x - a.x)
    result.push(a.y + t * (b.y - a.y))
  }
  return result
}

/** Min-max 정규화 → [0, 1] */
export function minMaxNormalize(arr: number[]): number[] {
  const min = Math.min(...arr)
  const max = Math.max(...arr)
  const range = max - min
  if (range === 0) return arr.map(() => 0.5)
  return arr.map(v => (v - min) / range)
}

/** Pearson 상관계수 (-1 ~ 1) */
export function pearsonCorr(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  const meanA = a.slice(0, n).reduce((s, x) => s + x, 0) / n
  const meanB = b.slice(0, n).reduce((s, x) => s + x, 0) / n
  let num = 0, ssA = 0, ssB = 0
  for (let i = 0; i < n; i++) {
    const dA = a[i] - meanA, dB = b[i] - meanB
    num += dA * dB; ssA += dA * dA; ssB += dB * dB
  }
  if (ssA === 0 || ssB === 0) return 0
  return num / Math.sqrt(ssA * ssB)
}

export interface PatternMatch {
  pattern: PatternDefinition
  score: number       // 0~100 — (r+1)/2×100
  correlation: number // Pearson r (-1~1)
  interpolated: number[] // 60포인트 보간값
}

/** 전체 패턴 매칭 점수 계산 (내림차순 정렬) */
export function matchPatterns(closes: number[], patterns: PatternDefinition[], windowSize = 60): PatternMatch[] {
  const window = closes.slice(-windowSize)
  const normalized = minMaxNormalize(window)
  return patterns
    .map(pattern => {
      const interpolated = interpolatePattern(pattern.curve, window.length)
      const r = pearsonCorr(normalized, interpolated)
      return { pattern, correlation: r, score: Math.round(((r + 1) / 2) * 100), interpolated }
    })
    .sort((a, b) => b.score - a.score)
}
```

**Step 2: Commit**

```bash
git add charting/frontend/src/lib/patternMatcher.ts
git commit -m "feat(frontend): add pattern matcher (Pearson correlation)"
```

---

## Task 4: Create `src/lib/indicators.ts`

**Files:**
- Create: `charting/frontend/src/lib/indicators.ts`

**Step 1: Write file**

```typescript
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
```

**Step 2: Commit**

```bash
git add charting/frontend/src/lib/indicators.ts
git commit -m "feat(frontend): add MA, BB, RSI, MACD indicator calculations"
```

---

## Task 5: Create `src/components/IndicatorToggle.tsx`

**Files:**
- Create: `charting/frontend/src/components/IndicatorToggle.tsx`

**Step 1: Write file**

```typescript
// charting/frontend/src/components/IndicatorToggle.tsx
import React from 'react'

export interface Indicators {
  ma5: boolean
  ma20: boolean
  ma60: boolean
  bb: boolean
  volume: boolean
  rsi: boolean
  macd: boolean
}

interface Props {
  value: Indicators
  onChange: (next: Indicators) => void
}

const BUTTONS: { key: keyof Indicators; label: string; color: string }[] = [
  { key: 'ma5',    label: 'MA5',    color: '#f59e0b' },
  { key: 'ma20',   label: 'MA20',   color: '#3b82f6' },
  { key: 'ma60',   label: 'MA60',   color: '#a855f7' },
  { key: 'bb',     label: 'BB',     color: '#06b6d4' },
  { key: 'volume', label: 'VOL',    color: '#6b7280' },
  { key: 'rsi',    label: 'RSI',    color: '#10b981' },
  { key: 'macd',   label: 'MACD',   color: '#ef4444' },
]

export function IndicatorToggle({ value, onChange }: Props) {
  const toggle = (key: keyof Indicators) =>
    onChange({ ...value, [key]: !value[key] })

  return (
    <div style={{ display: 'flex', gap: 6, padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
      {BUTTONS.map(({ key, label, color }) => {
        const active = value[key]
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            style={{
              padding: '4px 12px',
              fontSize: 12,
              fontWeight: 600,
              border: `1.5px solid ${active ? color : '#d1d5db'}`,
              borderRadius: 20,
              background: active ? color : '#fff',
              color: active ? '#fff' : '#6b7280',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add charting/frontend/src/components/IndicatorToggle.tsx
git commit -m "feat(frontend): add indicator toggle buttons"
```

---

## Task 6: Create `src/components/PatternSelector.tsx`

**Files:**
- Create: `charting/frontend/src/components/PatternSelector.tsx`

**Step 1: Write file**

```typescript
// charting/frontend/src/components/PatternSelector.tsx
import React from 'react'
import type { PatternMatch } from '../lib/patternMatcher'
import type { Signal } from '../lib/patterns'

interface Props {
  matches: PatternMatch[]
  selectedId: string
  onChange: (id: string) => void
}

const SIGNAL_STYLE: Record<Signal, { bg: string; text: string; label: string }> = {
  bullish: { bg: '#dcfce7', text: '#15803d', label: '🟢 상승' },
  bearish: { bg: '#fee2e2', text: '#b91c1c', label: '🔴 하락' },
  neutral: { bg: '#fef9c3', text: '#a16207', label: '🟡 중립' },
}

export function PatternSelector({ matches, selectedId, onChange }: Props) {
  const selected = matches.find(m => m.pattern.id === selectedId) ?? matches[0]

  if (matches.length === 0) {
    return <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13 }}>종목을 선택하면 패턴 분석이 시작됩니다.</div>
  }

  const sig = selected ? SIGNAL_STYLE[selected.pattern.signal] : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: '#fff', borderBottom: '1px solid #e2e8f0' }}>
      <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>패턴 선택</label>

      <select
        value={selectedId}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1, maxWidth: 300, padding: '6px 10px', border: '1.5px solid #d1d5db', borderRadius: 6, fontSize: 13, fontWeight: 600, background: '#fff' }}
      >
        {matches.map(m => (
          <option key={m.pattern.id} value={m.pattern.id}>
            {m.pattern.name} — {m.score}% 일치
          </option>
        ))}
      </select>

      {sig && (
        <span style={{ padding: '4px 12px', borderRadius: 20, background: sig.bg, color: sig.text, fontSize: 12, fontWeight: 700 }}>
          {sig.label}
        </span>
      )}

      {selected && (
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          매칭률: <strong style={{ color: '#1e293b' }}>{selected.score}%</strong>
        </span>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add charting/frontend/src/components/PatternSelector.tsx
git commit -m "feat(frontend): add pattern selector dropdown"
```

---

## Task 7: Create `src/components/PatternInfoBar.tsx`

**Files:**
- Create: `charting/frontend/src/components/PatternInfoBar.tsx`

**Step 1: Write file**

```typescript
// charting/frontend/src/components/PatternInfoBar.tsx
import React from 'react'
import type { PatternMatch } from '../lib/patternMatcher'
import type { Signal } from '../lib/patterns'

interface Props {
  match: PatternMatch | null
}

const SIGNAL_COLOR: Record<Signal, string> = {
  bullish: '#15803d', bearish: '#b91c1c', neutral: '#a16207',
}

export function PatternInfoBar({ match }: Props) {
  if (!match) return null
  const { pattern, score, correlation } = match
  const sigColor = SIGNAL_COLOR[pattern.signal]

  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '16px 20px', margin: '12px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1e293b' }}>{pattern.name}</span>
        <span style={{ fontSize: 12, color: sigColor, fontWeight: 600 }}>
          {pattern.signal === 'bullish' ? '▲ 상승 예상' : pattern.signal === 'bearish' ? '▼ 하락 예상' : '→ 중립'}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>r = {correlation.toFixed(3)}</span>
      </div>

      {/* Match score bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
          <span>매칭 정확도</span><span style={{ fontWeight: 700, color: '#1e293b' }}>{score}%</span>
        </div>
        <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${score}%`, background: pattern.color, borderRadius: 3, transition: 'width 0.4s' }} />
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, margin: '0 0 12px' }}>{pattern.description}</p>

      {/* Key points */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {pattern.keyPoints.map((pt, i) => (
          <span key={i} style={{ fontSize: 11, padding: '3px 8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, color: '#475569' }}>
            {pt}
          </span>
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add charting/frontend/src/components/PatternInfoBar.tsx
git commit -m "feat(frontend): add pattern info bar component"
```

---

## Task 8: Create `src/components/PatternChart.tsx` (메인 차트)

**Files:**
- Create: `charting/frontend/src/components/PatternChart.tsx`

이 컴포넌트가 핵심. Lightweight Charts 인스턴스를 생성·관리하며 서브차트 패널(Volume/RSI/MACD)을 조건부로 렌더링한다.

**Step 1: Write file**

```typescript
// charting/frontend/src/components/PatternChart.tsx
import React, { useEffect, useRef, MutableRefObject } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type Time,
  type LogicalRange,
} from 'lightweight-charts'
import { addDays, format, parseISO } from 'date-fns'
import type { OhlcvBar } from '../api'
import type { PatternDefinition } from '../lib/patterns'
import type { Indicators } from './IndicatorToggle'
import { calcMA, calcBollingerBands, calcRSI, calcMACD } from '../lib/indicators'
import { interpolatePattern } from '../lib/patternMatcher'

const CHART_DEFAULTS = {
  layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#64748b' },
  grid: { vertLines: { color: '#f1f5f9' }, horzLines: { color: '#f1f5f9' } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: '#e2e8f0' },
  timeScale: { borderColor: '#e2e8f0', timeVisible: true, fixLeftEdge: false, fixRightEdge: false },
}

const WINDOW = 60
const PROJ_DAYS = 20

// ── Sub-chart panels ──────────────────────────────────────────────────────────

function VolumePanel({ ohlcv, mainRef }: { ohlcv: OhlcvBar[]; mainRef: MutableRefObject<IChartApi | null> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current || !mainRef.current) return
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 110, timeScale: { ...CHART_DEFAULTS.timeScale, visible: false } })

    const series = chart.addHistogramSeries({ priceFormat: { type: 'volume' }, priceScaleId: 'right' })
    series.setData(ohlcv.map(b => ({
      time: b.trade_date as Time,
      value: Number(b.volume),
      color: Number(b.close) >= Number(b.open) ? '#bbf7d0' : '#fecaca',
    })))

    const sync = (range: LogicalRange | null) => { if (range) chart.timeScale().setVisibleLogicalRange(range) }
    const syncBack = (range: LogicalRange | null) => { if (range) mainRef.current?.timeScale().setVisibleLogicalRange(range) }
    mainRef.current.timeScale().subscribeVisibleLogicalRangeChange(sync)
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncBack)

    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }))
    ro.observe(containerRef.current)
    return () => {
      mainRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(sync)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(syncBack)
      ro.disconnect()
      chart.remove()
    }
  }, [ohlcv])
  return (
    <div style={{ borderTop: '1px solid #e2e8f0' }}>
      <div style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>Volume</div>
      <div ref={containerRef} />
    </div>
  )
}

function RsiPanel({ ohlcv, mainRef }: { ohlcv: OhlcvBar[]; mainRef: MutableRefObject<IChartApi | null> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current || !mainRef.current) return
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 120, timeScale: { ...CHART_DEFAULTS.timeScale, visible: false } })

    const closes = ohlcv.map(b => Number(b.close))
    const rsiValues = calcRSI(closes)
    const series = chart.addLineSeries({ color: '#8b5cf6', lineWidth: 1 })
    series.setData(
      ohlcv.map((b, i) => ({ time: b.trade_date as Time, value: rsiValues[i] ?? 50 }))
        .filter((_, i) => rsiValues[i] !== null)
    )
    series.createPriceLine({ price: 70, color: '#ef4444', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OB 70' })
    series.createPriceLine({ price: 30, color: '#22c55e', lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'OS 30' })
    series.createPriceLine({ price: 50, color: '#94a3b8', lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: false, title: '' })

    const sync = (range: LogicalRange | null) => { if (range) chart.timeScale().setVisibleLogicalRange(range) }
    const syncBack = (range: LogicalRange | null) => { if (range) mainRef.current?.timeScale().setVisibleLogicalRange(range) }
    mainRef.current.timeScale().subscribeVisibleLogicalRangeChange(sync)
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncBack)

    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }))
    ro.observe(containerRef.current)
    return () => {
      mainRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(sync)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(syncBack)
      ro.disconnect()
      chart.remove()
    }
  }, [ohlcv])
  return (
    <div style={{ borderTop: '1px solid #e2e8f0' }}>
      <div style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>RSI (14)</div>
      <div ref={containerRef} />
    </div>
  )
}

function MacdPanel({ ohlcv, mainRef }: { ohlcv: OhlcvBar[]; mainRef: MutableRefObject<IChartApi | null> }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!containerRef.current || !mainRef.current) return
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 140, timeScale: { ...CHART_DEFAULTS.timeScale, visible: false } })

    const closes = ohlcv.map(b => Number(b.close))
    const macdData = calcMACD(closes)

    const histSeries = chart.addHistogramSeries({ priceScaleId: 'right', lastValueVisible: false })
    const macdSeries = chart.addLineSeries({ color: '#2563eb', lineWidth: 1, lastValueVisible: false })
    const signalSeries = chart.addLineSeries({ color: '#ef4444', lineWidth: 1, lastValueVisible: false })

    const validData = ohlcv.map((b, i) => ({ time: b.trade_date as Time, point: macdData[i] })).filter(d => d.point !== null)

    histSeries.setData(validData.map(d => ({ time: d.time, value: d.point!.histogram, color: d.point!.histogram >= 0 ? '#bbf7d0' : '#fecaca' })))
    macdSeries.setData(validData.map(d => ({ time: d.time, value: d.point!.macd })))
    signalSeries.setData(validData.map(d => ({ time: d.time, value: d.point!.signal })))

    const sync = (range: LogicalRange | null) => { if (range) chart.timeScale().setVisibleLogicalRange(range) }
    const syncBack = (range: LogicalRange | null) => { if (range) mainRef.current?.timeScale().setVisibleLogicalRange(range) }
    mainRef.current.timeScale().subscribeVisibleLogicalRangeChange(sync)
    chart.timeScale().subscribeVisibleLogicalRangeChange(syncBack)

    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }))
    ro.observe(containerRef.current)
    return () => {
      mainRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(sync)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(syncBack)
      ro.disconnect()
      chart.remove()
    }
  }, [ohlcv])
  return (
    <div style={{ borderTop: '1px solid #e2e8f0' }}>
      <div style={{ padding: '4px 12px', fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>MACD (12,26,9)</div>
      <div ref={containerRef} />
    </div>
  )
}

// ── Main chart ────────────────────────────────────────────────────────────────

interface Props {
  ohlcv: OhlcvBar[]
  pattern: PatternDefinition | null
  indicators: Indicators
}

export function PatternChart({ ohlcv, pattern, indicators }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  // Chart initialisation (once)
  useEffect(() => {
    if (!containerRef.current) return
    const chart = createChart(containerRef.current, { ...CHART_DEFAULTS, height: 440 })
    chartRef.current = chart
    const ro = new ResizeObserver(() => chart.applyOptions({ width: containerRef.current!.clientWidth }))
    ro.observe(containerRef.current)
    return () => { ro.disconnect(); chart.remove(); chartRef.current = null }
  }, [])

  // Data update whenever ohlcv / pattern / indicators change
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || ohlcv.length === 0) return

    // Remove all series and rebuild (simplest safe approach)
    // lightweight-charts v4: removeSeries is available
    try {
      // @ts-ignore — access internal series list for cleanup
      chart.getSeries?.()?.forEach?.((s: any) => chart.removeSeries(s))
    } catch { /* ignore */ }

    const closes = ohlcv.map(b => Number(b.close))

    // ── Candlestick ──────────────────────────────────────────────────────────
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#16a34a', borderDownColor: '#dc2626',
      wickUpColor: '#16a34a', wickDownColor: '#dc2626',
    })
    candleSeries.setData(ohlcv.map(b => ({
      time: b.trade_date as Time,
      open: Number(b.open), high: Number(b.high), low: Number(b.low), close: Number(b.close),
    })))

    // ── MA Lines ─────────────────────────────────────────────────────────────
    const maConfig = [
      { key: 'ma5'  as const, period: 5,  color: '#f59e0b' },
      { key: 'ma20' as const, period: 20, color: '#3b82f6' },
      { key: 'ma60' as const, period: 60, color: '#a855f7' },
    ]
    maConfig.forEach(({ key, period, color }) => {
      if (!indicators[key]) return
      const maValues = calcMA(closes, period)
      const series = chart.addLineSeries({ color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false })
      series.setData(ohlcv.map((b, i) => ({ time: b.trade_date as Time, value: maValues[i] ?? NaN })).filter(d => !isNaN(d.value)))
    })

    // ── Bollinger Bands ──────────────────────────────────────────────────────
    if (indicators.bb) {
      const bb = calcBollingerBands(closes)
      const upperSeries = chart.addLineSeries({ color: '#06b6d4', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false })
      const lowerSeries = chart.addLineSeries({ color: '#06b6d4', lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false })
      const filtered = ohlcv.map((b, i) => ({ time: b.trade_date as Time, pt: bb[i] })).filter(d => d.pt !== null)
      upperSeries.setData(filtered.map(d => ({ time: d.time, value: d.pt!.upper })))
      lowerSeries.setData(filtered.map(d => ({ time: d.time, value: d.pt!.lower })))
    }

    // ── Pattern Overlay + Projection ─────────────────────────────────────────
    if (pattern && ohlcv.length >= WINDOW) {
      const windowBars = ohlcv.slice(-WINDOW)
      const windowCloses = windowBars.map(b => Number(b.close))
      const priceMin = Math.min(...windowCloses)
      const priceMax = Math.max(...windowCloses)
      const priceRange = priceMax - priceMin
      const scale = (y: number) => priceMin + y * priceRange

      // Pattern overlay (solid)
      const patternInterp = interpolatePattern(pattern.curve, WINDOW)
      const overlaySeries = chart.addLineSeries({
        color: pattern.color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false,
      })
      const overlayData = windowBars.map((b, i) => ({ time: b.trade_date as Time, value: scale(patternInterp[i]) }))
      // Add connection point (last bar shared with projection)
      overlaySeries.setData(overlayData)

      // Projection (dashed, future dates)
      const projInterp = interpolatePattern(pattern.projection, PROJ_DAYS + 1)
      const lastDate = parseISO(windowBars[windowBars.length - 1].trade_date)
      const projSeries = chart.addLineSeries({
        color: pattern.color, lineWidth: 2, lineStyle: LineStyle.Dashed,
        priceLineVisible: false, lastValueVisible: false,
      })
      const projData = [
        { time: windowBars[windowBars.length - 1].trade_date as Time, value: scale(projInterp[0]) },
        ...Array.from({ length: PROJ_DAYS }, (_, i) => ({
          time: format(addDays(lastDate, i + 1), 'yyyy-MM-dd') as Time,
          value: scale(projInterp[i + 1]),
        })),
      ]
      projSeries.setData(projData)

      // "Now" marker
      overlaySeries.setMarkers([{
        time: windowBars[windowBars.length - 1].trade_date as Time,
        position: 'aboveBar',
        color: pattern.color,
        shape: 'arrowDown',
        text: 'Now',
      }])
    }

    chart.timeScale().fitContent()
  }, [ohlcv, pattern, indicators])

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', margin: '0 16px' }}>
      {ohlcv.length === 0 ? (
        <div style={{ height: 440, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>
          종목을 선택하면 차트가 로드됩니다.
        </div>
      ) : (
        <div ref={containerRef} />
      )}
      {ohlcv.length > 0 && indicators.volume && <VolumePanel ohlcv={ohlcv} mainRef={chartRef} />}
      {ohlcv.length > 0 && indicators.rsi    && <RsiPanel    ohlcv={ohlcv} mainRef={chartRef} />}
      {ohlcv.length > 0 && indicators.macd   && <MacdPanel   ohlcv={ohlcv} mainRef={chartRef} />}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add charting/frontend/src/components/PatternChart.tsx
git commit -m "feat(frontend): add PatternChart with lightweight-charts + sub-panels"
```

---

## Task 9: Rewrite `src/App.tsx`

**Files:**
- Modify: `charting/frontend/src/App.tsx`

**Step 1: Replace entire file**

```typescript
// charting/frontend/src/App.tsx
import React, { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { SymbolSearch } from './components/SymbolSearch'
import { IndicatorToggle, type Indicators } from './components/IndicatorToggle'
import { PatternSelector } from './components/PatternSelector'
import { PatternChart } from './components/PatternChart'
import { PatternInfoBar } from './components/PatternInfoBar'
import { fetchOhlcv } from './api'
import { PATTERNS } from './lib/patterns'
import { matchPatterns, type PatternMatch } from './lib/patternMatcher'

const DEFAULT_INDICATORS: Indicators = {
  ma5: true, ma20: true, ma60: false,
  bb: false, volume: true, rsi: false, macd: false,
}

export default function App() {
  const [ticker, setTicker] = useState('')
  const [indicators, setIndicators] = useState<Indicators>(DEFAULT_INDICATORS)
  const [patternMatches, setPatternMatches] = useState<PatternMatch[]>([])
  const [selectedPatternId, setSelectedPatternId] = useState<string>('')

  const { data: ohlcv = [], isLoading } = useQuery({
    queryKey: ['ohlcv', ticker],
    queryFn: () => fetchOhlcv(ticker),
    enabled: !!ticker,
  })

  // Auto-compute pattern matches when OHLCV data loads
  useEffect(() => {
    if (ohlcv.length >= 60) {
      const closes = ohlcv.map(b => Number(b.close))
      const matches = matchPatterns(closes, PATTERNS)
      setPatternMatches(matches)
      setSelectedPatternId(matches[0]?.pattern.id ?? '')
    } else {
      setPatternMatches([])
      setSelectedPatternId('')
    }
  }, [ohlcv])

  const selectedMatch = patternMatches.find(m => m.pattern.id === selectedPatternId) ?? null
  const selectedPattern = selectedMatch?.pattern ?? null

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <header style={{ background: 'linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)', color: '#fff', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px' }}>📊 Chart Pattern Analysis</span>
        {ticker && <span style={{ fontSize: 13, background: 'rgba(255,255,255,0.15)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>{ticker}</span>}
        {isLoading && <span style={{ fontSize: 12, opacity: 0.7 }}>로딩 중…</span>}
      </header>

      {/* Symbol Search */}
      <SymbolSearch onSelect={setTicker} selectedTicker={ticker} />

      {/* Pattern Selector (only when data is ready) */}
      <PatternSelector
        matches={patternMatches}
        selectedId={selectedPatternId}
        onChange={setSelectedPatternId}
      />

      {/* Indicator Toggles */}
      <IndicatorToggle value={indicators} onChange={setIndicators} />

      {/* Main Chart */}
      <div style={{ paddingTop: 12 }}>
        <PatternChart
          ohlcv={ohlcv}
          pattern={selectedPattern}
          indicators={indicators}
        />
      </div>

      {/* Pattern Info */}
      <PatternInfoBar match={selectedMatch} />
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add charting/frontend/src/App.tsx
git commit -m "feat(frontend): redesign App layout around pattern chart"
```

---

## Task 10: Delete old unused components

**Files to delete:**
- `charting/frontend/src/components/ChartOverlay.tsx`
- `charting/frontend/src/components/DateRangePicker.tsx`
- `charting/frontend/src/components/SimilarityResultList.tsx`
- `charting/frontend/src/components/ForecastSummary.tsx`

**Step 1: Delete files**

```bash
cd charting/frontend/src/components
rm ChartOverlay.tsx DateRangePicker.tsx SimilarityResultList.tsx ForecastSummary.tsx
```

**Step 2: Verify TypeScript compilation**

```bash
cd /Users/gideok-kwon/IdeaProjects/feature-CHARTING/charting/frontend
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only ignorable warnings)

**Step 3: Commit**

```bash
git add -A
git commit -m "chore(frontend): remove legacy chart components"
```

---

## Task 11: End-to-end verification

**Step 1: Ensure API and DB are running**

```bash
# Check API
curl -s http://localhost:8010/health
# Expected: {"status":"ok"}

# Check DB has data
docker exec charting-db psql -U charting -d charting -c "SELECT ticker, COUNT(*) FROM symbols s JOIN ohlcv_bars o ON s.id=o.symbol_id GROUP BY ticker;"
```

**Step 2: Start (or restart) frontend dev server**

```bash
cd /Users/gideok-kwon/IdeaProjects/feature-CHARTING/charting/frontend
# Kill existing if running
pkill -f "vite" 2>/dev/null || true
sleep 1
VITE_API_BASE_URL=http://localhost:8010 npm run dev &
sleep 3
open http://localhost:5173
```

**Step 3: Manual verification checklist**

- [ ] 헤더 표시 확인
- [ ] 종목 드롭다운에서 AAPL 선택
- [ ] 캔들스틱 차트가 렌더링됨
- [ ] 패턴 선택 드롭다운에 10개 패턴 + 매칭률(%) 표시
- [ ] 자동 선택된 패턴 오버레이(주황 실선)가 60일 구간에 표시됨
- [ ] 미래 추세 점선이 오른쪽으로 연장됨
- [ ] [MA5][MA20] 토글 ON/OFF 시 차트 즉시 반영
- [ ] [BB] 토글 ON 시 볼린저밴드 표시
- [ ] [VOL] 토글 ON 시 하단 Volume 서브차트 표시
- [ ] [RSI] 토글 ON 시 RSI 서브차트 + 70/30 기준선 표시
- [ ] [MACD] 토글 ON 시 MACD 히스토그램 + 선 표시
- [ ] 패턴 변경 시 오버레이·점선·패턴 정보 즉시 교체
- [ ] 패턴 정보 바: 이름, 매칭률 바, 신호, 설명, 핵심 포인트 표시

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(frontend): complete pattern chart UI with lightweight-charts"
```
