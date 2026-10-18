import { forwardRef, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { MarketAttractionRef, MarketSearchResult } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import { marketMapPath, NAVER_MAP_KEY_ID } from '../../seo/copy.mjs';
import { useAttractionMarket } from './marketQueries';
import MarketNaverMap from './MarketNaverMap';
import './AttractionMarket.css';

export type MarketSearchPick = { contentId: string; name: string; attraction: MarketAttractionRef | null; storeId: number | null };

/** 검색 결과 옆에 고른 시장의 지도를 띄운다. 지도 키가 없거나 응답이 실패하면 아무것도 그리지 않는다 — 결과 링크가 전체 지도로 간다. */
const MarketSearchMap = forwardRef<HTMLElement, { pick: MarketSearchPick; lang: PlaceLang; query: string; results?: MarketSearchResult['stores']['items'] }>(function MarketSearchMap({ pick, lang, query, results }, ref) {
  const en = lang === 'en';
  const { data, isError } = useAttractionMarket(pick.contentId, lang);
  const [selected, setSelected] = useState<{ contentId: string; key: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const navigate = useNavigate();
  const href = pick.attraction ? marketMapPath(pick.attraction.lang, pick.attraction.id) : null;
  const full = (params: Record<string, string>) => href && `${href}${Object.keys(params).length ? `?${new URLSearchParams(params)}` : ''}`;
  const selectedKey = selected?.contentId === pick.contentId ? selected.key : null;
  // 검색 결과에 나온 이 시장의 가게를 지도에서 강조한다.
  const selection = useMemo(() => ({ storeId: pick.storeId, selectedKey,
    searchStoreIds: (results ?? []).filter(shop => shop.marketContentId === pick.contentId).map(shop => shop.storeId) }), [pick.storeId, pick.contentId, selectedKey, results]);
  if (!NAVER_MAP_KEY_ID || isError || data === null || failed === pick.contentId) return null;
  return <section ref={ref} className="market-search-map" aria-label={en ? `${pick.name} map` : `${pick.name} 지도`}>
    <header>
      <h2>{pick.name}</h2>
      {href && <Link to={full(query ? { marketQuery: query } : {})!}>{en ? 'Open full map' : '지도 크게 보기'}</Link>}
    </header>
    <div className="market-search-map-frame">
      {data ? <MarketNaverMap contentId={pick.contentId} data={data} lang={lang} keyId={NAVER_MAP_KEY_ID} selection={selection}
        onSelect={key => setSelected({ contentId: pick.contentId, key })} onError={() => setFailed(pick.contentId)}
        onOpenStore={href ? id => navigate(full({ store: String(id) })!) : undefined}
        onShowList={href ? () => navigate(full(query ? { marketQuery: query } : {})!) : undefined} />
        : <p role="status">{en ? 'Loading map…' : '지도 불러오는 중…'}</p>}
    </div>
  </section>;
});
export default MarketSearchMap;
