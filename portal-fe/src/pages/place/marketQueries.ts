import { useQuery } from '@tanstack/react-query';
import { fetchMarket } from '../../api/marketApi';
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
