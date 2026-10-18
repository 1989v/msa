import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchMarkets } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import { marketMapPath } from '../../seo/copy.mjs';
import './PlaceMarketMatches.css';

const LIMIT = 5;

/**
 * 장소 검색어가 시장 이름과 맞으면 목록 위에 그 시장들을 띄우고 시장 지도로 보낸다.
 * 시장(쇼핑 분류)은 목록 분류에서 빠져 있고 지역 선택과도 무관하게 찾는다 — 「경주 중앙시장」을 서울 목록에서 친 사람도 닿게.
 */
export default function PlaceMarketMatches({ keyword, lang }: { keyword: string; lang: PlaceLang }) {
  const en = lang === 'en';
  const q = keyword.trim();
  const { data } = useQuery({ queryKey: ['place-market-matches', q, lang], queryFn: () => searchMarkets(q, lang, 0, LIMIT), enabled: q.length > 0, staleTime: 60_000, retry: false });
  const markets = (data?.markets ?? []).filter(market => market.attraction).slice(0, LIMIT);
  if (!q || markets.length === 0) return null;
  return <nav className="place-market-matches" aria-label={en ? 'Matching markets' : '찾은 시장'}>
    <h2>{en ? `Markets (${markets.length})` : `시장 ${markets.length}곳`}</h2>
    <ul>{markets.map(market => <li key={market.contentId}>
      <Link to={marketMapPath(market.attraction!.lang, market.attraction!.id)}>
        <strong>{market.name}</strong>
        <span>{[market.region, en ? `${market.storeCount} shops` : `가게 ${market.storeCount}곳`].filter(Boolean).join(' · ')}</span>
        <span className="place-market-matches-go">{en ? 'Market map' : '시장 지도'} →</span>
      </Link>
    </li>)}</ul>
  </nav>;
}
