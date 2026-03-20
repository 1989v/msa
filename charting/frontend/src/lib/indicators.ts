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
