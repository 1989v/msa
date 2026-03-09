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
