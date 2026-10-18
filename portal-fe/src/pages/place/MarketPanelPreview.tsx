import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketContentIds } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import { marketMapPath, NAVER_MAP_KEY_ID } from '../../seo/copy.mjs';
import { useAttractionMarket } from './marketQueries';
import MarketNaverMap from './MarketNaverMap';
import './AttractionMarket.css';

/** 장소 검색에서 고른 관광지가 시장이면 패널 안에 시장 지도 미리보기와 전체 지도 링크를 둔다. 시장이 아니면 시장 응답을 부르지 않는다. */
export default function MarketPanelPreview({ contentId, attractionId, lang }: { contentId: string; attractionId: string; lang: PlaceLang }) {
  const en = lang === 'en';
  const { data: ids } = useQuery({ queryKey: ['market-content-ids'], queryFn: fetchMarketContentIds, staleTime: 60 * 60_000, retry: false });
  const isMarket = ids?.includes(contentId) ?? false;
  const { data } = useAttractionMarket(isMarket ? contentId : '', lang);
  const [failed, setFailed] = useState<string | null>(null);
  const navigate = useNavigate();
  if (!isMarket) return null;
  const href = marketMapPath(lang, attractionId);
  const label = en ? 'View market map' : '시장 지도 보기';
  const count = data?.stores.filter(store => store.membership !== 'OUT').length;
  return <section className="place-market-panel" aria-label={label}>
    {NAVER_MAP_KEY_ID && data && failed !== contentId && <div className="place-market-preview">
      <MarketNaverMap contentId={contentId} data={data} lang={lang} keyId={NAVER_MAP_KEY_ID} interactive={false} initialZoom={16} onActivate={() => navigate(href)} onError={() => setFailed(contentId)} />
      <Link className="place-market-preview-link" to={href} aria-label={label} tabIndex={-1} />
    </div>}
    <Link className="place-btn primary" to={href}>{label}{count ? (en ? ` · ${count} shops` : ` · 가게 ${count}곳`) : ''}</Link>
  </section>;
}
