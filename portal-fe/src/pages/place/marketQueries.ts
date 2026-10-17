import { useQuery } from '@tanstack/react-query';
import { fetchMarket, fetchMarketDishes, fetchMarketBasemapMeta } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';

export function useAttractionMarket(contentId: string, lang: PlaceLang, includeOutside = false) {
  return useQuery({
    queryKey: ['attraction-market', contentId, includeOutside, lang],
    queryFn: () => fetchMarket(contentId, includeOutside, lang),
    enabled: contentId.length > 0,
    staleTime: 10 * 60_000,
    retry: false,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === contentId ? previous : undefined,
  });
}

export function useMarketDishes() {
  return useQuery({ queryKey: ['market-dishes'], queryFn: fetchMarketDishes, staleTime: 24 * 60 * 60_000, gcTime: 24 * 60 * 60_000, retry: false });
}

export function useMarketBasemapMeta(contentId: string) {
  return useQuery({
    queryKey: ['market-basemap-meta', contentId],
    queryFn: () => fetchMarketBasemapMeta(contentId),
    enabled: contentId.length > 0,
    staleTime: 60 * 60_000,
    retry: false,
  });
}
