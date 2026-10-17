import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAttractionMarket } from './marketQueries';
import type { MarketResponse } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import { formatGoodPriceSummary, marketDisplayName } from './marketView';
import { marketMapPath, NAVER_MAP_KEY_ID, placePath } from '../../seo/copy.mjs';
import { marketStoreTypeCounts } from './marketStoreType';
import MarketNaverMap from './MarketNaverMap';
import MarketMenuDetails from './MarketMenuDetails';
import MarketStewardApplication from './MarketStewardApplication';
import './AttractionMarket.css';

const COPY = {
  ko: { title: '시장 구역·가게', type: '시장 유형', count: '점포수', cycle: '개설주기', facilities: '편의시설', zones: '가게 유형', fullMap: '지도 전체 보기', types: { STREET: '거리형', BUILDING: '건물형', MIXED: '혼합형' } },
  en: { title: 'Market areas & shops', type: 'Market type', count: 'Shop count', cycle: 'Opening schedule', facilities: 'Facilities', zones: 'Shop types', fullMap: 'View full map', types: { STREET: 'Street market', BUILDING: 'Building market', MIXED: 'Mixed market' } },
} as const;

/** A failed or absent market response only removes this optional section. */
export default function AttractionMarket({ contentId, attractionId, lang }: { contentId: string; attractionId: string; lang: PlaceLang }) {
  const { data, isError } = useAttractionMarket(contentId, lang);
  if (!data || isError) return null;
  return <MarketSection contentId={contentId} attractionId={attractionId} data={data} lang={lang} />;
}

function MarketSection({ contentId, attractionId, data, lang }: { contentId: string; attractionId: string; data: MarketResponse; lang: PlaceLang }) {
  const C = COPY[lang];
  const href = marketMapPath(lang, attractionId);
  const navigate = useNavigate();
  // 미리보기 지도가 못 뜨면(키·SDK·인증) 카드는 지도 없이 링크만 남긴다 — 오류 문구를 카드에 두지 않는다.
  const [previewFailed, setPreviewFailed] = useState(false);
  const types = marketStoreTypeCounts(data.stores.filter(store => store.membership === 'IN'));
  const { attribution, goodPrice } = data.market;
  const facts = [[C.type, C.types[data.market.marketType]], [C.count, data.market.storeCountRaw], [C.cycle, data.market.openingCycle], [C.facilities, data.market.facilities]];
  return (
    <section id="market" tabIndex={-1} className="place-market" aria-label={C.title} data-place-section="market">
      <h2 className="place-detail-info-title">{C.title}</h2>
      <article className="place-market-summary" aria-label={data.market.name}>
        <h3 className="place-market-name">{data.market.name}</h3>
        <dl className="place-market-facts">
          {facts.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
        </dl>
        {goodPrice && <p className="place-market-source place-market-good-price-summary">
          {formatGoodPriceSummary(goodPrice, lang)}{' · '}<a href={goodPrice.attribution.url} target="_blank" rel="noreferrer">{goodPrice.attribution.name}</a>
        </p>}
        {attribution && <p className="place-market-source"><a href={attribution.url} target="_blank" rel="noreferrer">{attribution.name}</a>{' · '}{attribution.license}</p>}
        {(data.attribution ?? []).map(credit => <p className="place-market-source" key={credit}>{credit}</p>)}
        <nav className="place-market-types" aria-label={C.zones}>
          {types.slice(0, 3).map(type => <Link key={type.key} to={`${href}?type=${type.key}`}>{type[lang]} ({type.count})</Link>)}
        </nav>
        {NAVER_MAP_KEY_ID && !previewFailed && <div className="place-market-preview">
          <MarketNaverMap contentId={contentId} data={data} lang={lang} keyId={NAVER_MAP_KEY_ID} interactive={false} initialZoom={16} onActivate={() => navigate(href)} onError={() => setPreviewFailed(true)} />
          <Link className="place-market-preview-link" to={href} aria-label={C.fullMap} />
        </div>}
        <Link className="place-market-full-map" to={href}>{C.fullMap}</Link>
      </article>
      {(data.restaurants ?? []).length > 0 && <section aria-label={lang === 'en' ? 'Restaurants introduced by Korea Tourism Organization' : '관광공사 소개 음식점'}>
        <h3>{lang === 'en' ? 'Restaurants introduced by Korea Tourism Organization' : '관광공사 소개 음식점'}</h3>
        <ul className="place-market-shops">{data.restaurants!.map((restaurant) => <li key={`${restaurant.attraction.lang}-${restaurant.attraction.id}`}>
          <a href={placePath(restaurant.attraction.lang, `/attractions/${restaurant.attraction.id}`)}>{marketDisplayName({ ...restaurant, name: restaurant.title }, lang)}</a>
          <MarketMenuDetails store={{ items: null, tourMenu: restaurant }} lang={lang} />
        </li>)}</ul>
      </section>}
      {data.market.id != null && <MarketStewardApplication marketId={data.market.id} lang={lang} />}
    </section>
  );
}
