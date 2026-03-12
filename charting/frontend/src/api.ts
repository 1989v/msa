import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8010'

export const api = axios.create({ baseURL: BASE_URL })

// Types
export interface Symbol {
  id: number
  ticker: string
  name: string
  market: 'US' | 'KR'
  active: boolean
}

export interface OhlcvBar {
  trade_date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface SimilarPattern {
  pattern_id: number
  ticker: string
  start_date: string
  end_date: string
  similarity: number
  return_5d: number | null
  return_20d: number | null
  return_60d: number | null
}

export interface Forecast {
  patterns: number
  avg_return_5d: number | null
  avg_return_20d: number | null
  avg_return_60d: number | null
  median_return_5d: number | null
  median_return_20d: number | null
  median_return_60d: number | null
  positive_probability_5d: number | null
  positive_probability_20d: number | null
  positive_probability_60d: number | null
}

export interface SimilarityResponse {
  similar_patterns: SimilarPattern[]
  forecast: Forecast
}

// API calls
export const fetchSymbols = () =>
  api.get<Symbol[]>('/api/v1/symbols').then((r) => r.data)

export const registerSymbol = (ticker: string, name: string, market: 'US' | 'KR') =>
  api.post<Symbol>('/api/v1/symbols', { ticker, name, market }).then((r) => r.data)

export const fetchOhlcv = (ticker: string, start?: string, end?: string) =>
  api
    .get<OhlcvBar[]>(`/api/v1/${ticker}/ohlcv`, { params: { start, end } })
    .then((r) => r.data)

export const searchSimilarity = (ticker: string, windowEndDate?: string, topK = 20) =>
  api
    .post<SimilarityResponse>('/api/v1/similarity', {
      ticker,
      window_end_date: windowEndDate ?? null,
      top_k: topK,
    })
    .then((r) => r.data)
