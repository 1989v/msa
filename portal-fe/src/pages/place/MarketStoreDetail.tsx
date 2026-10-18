import { useEffect, useRef } from 'react';
import type { MarketStore } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import { formatGoodPriceMenu, formatMarketFloor, hasMarketCoordinate, marketDisplayName, marketSourceBadges } from './marketView';
import { MARKET_STORE_TYPES, marketStoreType, marketStoreTypeColor } from './marketStoreType';
import MarketMenuDetails from './MarketMenuDetails';

/** One shop in full, beside the map. Opened from the map's info window or a list row; closed by its button or Escape. */
export default function MarketStoreDetail({ store, number, lang, onClose, onFocus }: {
  store: MarketStore; number?: number; lang: PlaceLang; onClose: () => void; onFocus: (id: number) => void;
}) {
  const en = lang === 'en';
  const panel = useRef<HTMLElement>(null);
  // 들어오는 애니메이션 중에 포커스하면 브라우저가 패널을 보이려고 overflow:hidden 인 화면을 가로로 밀어 버린다.
  useEffect(() => { panel.current?.focus({ preventScroll: true }); }, [store.id]);
  const type = MARKET_STORE_TYPES.find(candidate => candidate.key === marketStoreType(store))!;
  const categories = [store.categoryMajor, store.categoryMid, store.categorySub].map(value => value?.trim()).filter(Boolean).join(' › ');
  const address = [store.roadAddress || store.jibunAddress, store.buildingName, store.dong, formatMarketFloor(store.floor, lang), store.ho].filter(Boolean).join(' · ');
  const position = store.pinKind === 'REFERENCE' ? [store.relativePosition, store.positionNote].filter(Boolean).join(' · ') : '';
  return <aside ref={panel} className="market-store-detail" role="dialog" aria-labelledby="market-store-detail-title" tabIndex={-1} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
    <header>
      <h2 id="market-store-detail-title">{number != null && <span className="market-list-no">{number}</span>}{marketDisplayName(store, lang)}{store.storeNo && <span className="market-store-no">{store.storeNo}</span>}</h2>
      <button type="button" aria-label={en ? 'Close' : '닫기'} onClick={onClose}>×</button>
    </header>
    <p className="market-store-detail-type"><span className="market-map-type-dot" aria-hidden="true" style={{ background: marketStoreTypeColor(type.key) }} />{type[lang]}{categories && <span className="place-market-source"> · {categories}</span>}</p>
    <div className="place-market-badges">
      {store.goodPrice && <span className="place-market-good-price-badge">{en ? 'Good price' : '착한가격'}</span>}
      {marketSourceBadges(store, lang).map(badge => <span key={badge}>{badge}</span>)}
      {store.nearby ? <span>{en ? 'Nearby · Membership unconfirmed' : '주변 · 소속 미확인'}</span> : store.membership === 'OUT' && <span>{en ? 'Outside market' : '시장 밖'}</span>}
      {store.membership === 'UNKNOWN' && <span>{en ? 'Location unconfirmed' : '위치 미확인'}</span>}
      {!hasMarketCoordinate(store) && <span>{en ? 'No map location' : '지도 위치 없음'}</span>}
    </div>
    {address && <p>{address}</p>}
    {position && <p>{position}</p>}
    {store.goodPrice && store.goodPrice.menus.length > 0 && <ul className="market-store-detail-menus">{store.goodPrice.menus.map((menu, index) => <li key={`${menu.name}-${index}`}>{formatGoodPriceMenu(menu, lang)}</li>)}</ul>}
    <MarketMenuDetails store={store} lang={lang} />
    {hasMarketCoordinate(store) && store.id != null && <p><button type="button" onClick={() => onFocus(store.id!)}>{en ? 'Show on map' : '지도에서 보기'}</button></p>}
  </aside>;
}
