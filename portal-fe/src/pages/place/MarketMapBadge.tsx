import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketContentIds } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import './MarketSearchPage.css';

export default function MarketMapBadge({ contentId, lang }: { contentId: string; lang: PlaceLang }) {
  const { data, isError } = useQuery({
    queryKey: ['market-content-ids'], queryFn: fetchMarketContentIds,
    staleTime: 60 * 60_000, retry: false,
  });
  const ids = useMemo(() => new Set(data ?? []), [data]);
  if (isError || !ids.has(contentId)) return null;
  return <span className="market-map-badge">{lang === 'en' ? 'Market map' : '시장 지도'}</span>;
}
