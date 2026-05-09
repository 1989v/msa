// charting/hooks/useOrderbook.ts — ADR-0039.
import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { ApiResponse } from '@/types/api'

export interface OrderbookLevel {
  price: string
  quantity: string
}

export interface OrderbookSnapshot {
  asset: string
  market: string
  asks: OrderbookLevel[]
  bids: OrderbookLevel[]
  ts: string
}

export interface TradeFill {
  price: string
  quantity: string
  side: 'BUY' | 'SELL'
  ts: string
}

export function useOrderbook(asset: string, market: string, enabled = true) {
  return useQuery({
    queryKey: ['orderbook', asset, market],
    enabled: enabled && market === 'BITHUMB' && !!asset, // CRYPTO 빗썸 전용
    queryFn: async (): Promise<OrderbookSnapshot | null> => {
      const qs = new URLSearchParams({ asset, market }).toString()
      const res = await apiClient.get<ApiResponse<OrderbookSnapshot | null>>(
        `/api/v1/charts/orderbook?${qs}`,
      )
      return unwrap(res)
    },
    refetchInterval: 2000, // 2초 polling (SSE delta 는 후속)
    retry: false,
  })
}

export function useTrades(asset: string, market: string, limit = 50, enabled = true) {
  return useQuery({
    queryKey: ['trades', asset, market, limit],
    enabled: enabled && market === 'BITHUMB' && !!asset,
    queryFn: async (): Promise<TradeFill[]> => {
      const qs = new URLSearchParams({
        asset,
        market,
        limit: String(limit),
      }).toString()
      const res = await apiClient.get<ApiResponse<TradeFill[]>>(
        `/api/v1/charts/trades?${qs}`,
      )
      return unwrap(res)
    },
    refetchInterval: 5000,
    retry: false,
  })
}
