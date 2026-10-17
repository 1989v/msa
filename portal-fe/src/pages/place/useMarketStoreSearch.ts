import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchMarketStores, type MatchedBy, type MarketStoreSearchResult } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';

export function marketStoreSearchEnabled(query: string) { return query.trim().length >= 2; }

/** Both market entry points use the same eligibility and unavailable/empty fallback policy. */
export function marketStoreSearchStatus(query: string, data: MarketStoreSearchResult | null | undefined): 'engine' | 'fallback' {
  return marketStoreSearchEnabled(query) && data && data.items.length > 0 ? 'engine' : 'fallback';
}

export function useMarketStoreSearch(query: string, contentId: string, lang: PlaceLang) {
  const term = query.trim();
  const [settled, setSettled] = useState<{ term: string; contentId: string; lang: PlaceLang } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSettled({ term, contentId, lang }), 300);
    return () => clearTimeout(timer);
  }, [term, contentId, lang]);
  const ready = marketStoreSearchEnabled(term) && !!contentId && settled?.term === term && settled.contentId === contentId && settled.lang === lang;
  const { data, isError } = useQuery({
    queryKey: ['market-store-search', term, contentId, lang],
    queryFn: () => searchMarketStores(term, { contentId, lang }),
    enabled: ready, staleTime: 5 * 60_000, retry: 0,
  });
  const status = marketStoreSearchStatus(term, ready && !isError ? data : null);
  return {
    status,
    storeIds: status === 'engine' ? data!.items.map(item => item.storeId) : [],
    matchedBy: new Map<number, MatchedBy>(status === 'engine' ? data!.items.map(item => [item.storeId, item.matchedBy]) : []),
  };
}
export type MarketStoreSearch = ReturnType<typeof useMarketStoreSearch>;
