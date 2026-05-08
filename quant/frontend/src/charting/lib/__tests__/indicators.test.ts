import { describe, it, expect } from 'vitest'
import {
  INDICATOR_META,
  activeSubPaneKeys,
  calcMA,
  calcRSI,
  calcOBV,
  calcBollingerBands,
  calcVWAP,
  type IndicatorKey,
} from '../indicators'

const ALL_KEYS: IndicatorKey[] = [
  'ma5',
  'ma20',
  'ma60',
  'ma120',
  'bb',
  'vwap',
  'volume',
  'rsi',
  'stochastic',
  'williamsR',
  'atr',
  'macd',
  'obv',
]

describe('INDICATOR_META', () => {
  it('has metadata for every IndicatorKey', () => {
    for (const key of ALL_KEYS) {
      const meta = INDICATOR_META[key]
      expect(meta, `${key} should have meta`).toBeDefined()
      expect(meta.label).toBeTruthy()
      expect(meta.paneGroup).toMatch(/^(overlay|volume|oscillator|momentum)$/)
      expect(meta.color).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('overlay group covers MA / BB / VWAP', () => {
    const overlay = (Object.keys(INDICATOR_META) as IndicatorKey[]).filter(
      k => INDICATOR_META[k].paneGroup === 'overlay',
    )
    expect(overlay).toEqual(
      expect.arrayContaining(['ma5', 'ma20', 'ma60', 'ma120', 'bb', 'vwap']),
    )
  })
})

describe('activeSubPaneKeys', () => {
  it('returns sub-pane keys in volume → oscillator → momentum order', () => {
    const result = activeSubPaneKeys({
      // overlay 는 무시되어야 함
      ma5: true,
      ma20: true,
      bb: true,
      vwap: true,
      // sub-pane (out of order — 함수가 stable order 로 정렬해야 함)
      obv: true,
      atr: true,
      stochastic: true,
      rsi: true,
      macd: true,
      volume: true,
      williamsR: true,
    })
    expect(result).toEqual([
      'volume', // volume group
      'rsi', // oscillator
      'stochastic',
      'williamsR',
      'atr',
      'macd', // momentum
      'obv',
    ])
  })

  it('returns empty array for empty input', () => {
    expect(activeSubPaneKeys({})).toEqual([])
  })

  it('skips overlay-group keys (returns empty when only overlays active)', () => {
    expect(
      activeSubPaneKeys({ ma20: true, vwap: true, bb: true, ma60: true }),
    ).toEqual([])
  })
})

describe('calcMA', () => {
  it('returns null for the first (period-1) bars, then arithmetic mean', () => {
    const closes = [1, 2, 3, 4, 5]
    const ma3 = calcMA(closes, 3)
    expect(ma3).toEqual([null, null, 2, 3, 4])
  })
})

describe('calcRSI', () => {
  it('returns all-null array when input shorter than period+1', () => {
    const result = calcRSI([1, 2, 3], 14)
    expect(result.every(v => v === null)).toBe(true)
  })

  it('returns values in [0, 100] for sufficient input', () => {
    const closes = Array.from(
      { length: 40 },
      (_, i) => 100 + Math.sin(i / 3) * 5,
    )
    const rsi = calcRSI(closes, 14)
    const finiteValues = rsi.filter(
      (v): v is number => v != null && Number.isFinite(v),
    )
    expect(finiteValues.length).toBeGreaterThan(0)
    finiteValues.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    })
  })
})

describe('calcOBV', () => {
  it('accumulates +volume on rise, -volume on fall, 0 on flat', () => {
    const closes = [10, 11, 11, 9, 10]
    const volumes = [100, 50, 80, 200, 30]
    expect(calcOBV(closes, volumes)).toEqual([0, 50, 50, -150, -120])
  })
})

describe('calcBollingerBands', () => {
  it('mid equals SMA, upper > mid > lower for non-flat input', () => {
    const closes = Array.from({ length: 25 }, (_, i) => 100 + i)
    const bb = calcBollingerBands(closes, 20, 2)
    const last = bb[bb.length - 1]
    expect(last).not.toBeNull()
    if (!last) return
    expect(last.upper).toBeGreaterThan(last.mid)
    expect(last.mid).toBeGreaterThan(last.lower)
  })
})

describe('calcVWAP', () => {
  it('returns single typical price when only one bar', () => {
    const result = calcVWAP([10], [8], [9], [100])
    // typical = (10 + 8 + 9) / 3 = 9
    expect(result[0]).toBeCloseTo(9)
  })

  it('null only when cumulative volume is zero', () => {
    const result = calcVWAP([10, 10], [10, 10], [10, 10], [0, 0])
    expect(result[0]).toBeNull()
  })
})
