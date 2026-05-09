// api/discover.ts — ADR-0042 PA 발견·트렌딩 endpoint client.
import { apiClient, unwrap } from './client'
import type { ApiResponse } from '@/types/api'

export interface MarketRanking {
  asset: string
  market: string
  assetClass: string
  displayName: string
  /** 최신 종가 (string — 백엔드 BigDecimal). */
  lastClose: string
  prevClose: string | null
  changePct: string | null
  turnover: string
  volume: string
}

export interface GlobalIndexQuote {
  ticker: string
  displayName: string
  price: string
  prevClose: string | null
  changePct: string | null
}

export type RankingKind = 'top-volume' | 'top-gainers' | 'top-losers'

export async function fetchRanking(
  kind: RankingKind,
  market?: string,
  limit = 20,
): Promise<MarketRanking[]> {
  const qs = new URLSearchParams({ limit: String(limit) })
  if (market) qs.set('market', market)
  const res = await apiClient.get<ApiResponse<MarketRanking[]>>(
    `/api/v1/discover/${kind}?${qs.toString()}`,
  )
  return unwrap(res)
}

export async function fetchGlobalIndices(): Promise<GlobalIndexQuote[]> {
  const res = await apiClient.get<ApiResponse<GlobalIndexQuote[]>>(
    '/api/v1/discover/global-indices',
  )
  return unwrap(res)
}
