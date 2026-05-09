// charting/hooks/useNews.ts — ADR-0041.
import { useQuery } from '@tanstack/react-query'
import { apiClient, unwrap } from '@/api/client'
import type { ApiResponse } from '@/types/api'

export interface NewsItem {
  title: string
  source: string
  url: string
  publishedAt: string  // ISO-8601
  summary: string | null
  kind: 'NEWS' | 'DISCLOSURE'
}

export function useNews(asset: string, market: string, limit = 20) {
  return useQuery({
    queryKey: ['news', asset, market, limit],
    enabled: !!asset && !!market,
    queryFn: async (): Promise<NewsItem[]> => {
      const qs = new URLSearchParams({
        asset,
        market,
        limit: String(limit),
      }).toString()
      const res = await apiClient.get<ApiResponse<NewsItem[]>>(
        `/api/v1/charts/news?${qs}`,
      )
      return unwrap(res)
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
}
