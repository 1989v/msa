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
