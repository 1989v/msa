// charting/hooks/useFundamentals.ts
//
// 종목 기초 데이터 (시총·PER·배당 등) — TG-9 / GET /api/v1/charts/fundamentals.
// 백엔드는 Yahoo v10 quoteSummary 를 호출하고 1h Caffeine 캐시.
import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { ApiResponse } from '@/types/api'

export interface Fundamentals {
  asset: string
  market: string
  /** 시가총액 (자산 통화 — STOCK_KR=원, STOCK_US=USD, CRYPTO=USD). */
  marketCap: string | null
  peRatio: string | null
  eps: string | null
  /** 배당수익률 (소수점 — 0.0043 = 0.43%). */
  dividendYield: string | null
  beta: string | null
  weeks52High: string | null
  weeks52Low: string | null
  avgDailyVolume: string | null
  asOf: string
}

export function useFundamentals(
  asset: string,
  market: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ['fundamentals', asset, market],
    enabled: enabled && !!asset && !!market,
    queryFn: async (): Promise<Fundamentals | null> => {
      const res = await apiClient.get<ApiResponse<Fundamentals | null>>(
        `/api/v1/charts/fundamentals?asset=${encodeURIComponent(asset)}&market=${encodeURIComponent(market)}`,
      )
      return unwrap(res)
    },
    staleTime: 1000 * 60 * 30, // 30 min (백엔드 TTL 1h 의 절반)
    retry: false,
  })
}
