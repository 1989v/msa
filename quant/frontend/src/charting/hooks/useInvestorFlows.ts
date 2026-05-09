// charting/hooks/useInvestorFlows.ts — ADR-0040.
import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { ApiResponse } from '@/types/api'

export interface InvestorFlowItem {
  tradeDate: string // YYYY-MM-DD
  individualNet: number
  foreignNet: number
  institutionNet: number
}

export function useInvestorFlows(
  asset: string,
  market: string,
  from: string,
  to: string,
  enabled = true,
) {
  return useQuery({
    queryKey: ['investor-flows', asset, market, from, to],
    enabled: enabled && market === 'FDR_KR' && !!asset, // KR 주식 전용
    queryFn: async (): Promise<InvestorFlowItem[]> => {
      const qs = new URLSearchParams({ asset, market, from, to }).toString()
      const res = await apiClient.get<ApiResponse<InvestorFlowItem[]>>(
        `/api/v1/charts/investor-flows?${qs}`,
      )
      return unwrap(res)
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
}
