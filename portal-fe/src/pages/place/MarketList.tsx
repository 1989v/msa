import { useState } from 'react';
import type { MarketDish, MarketResponse } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import type { MarketViewport } from './MarketNaverMap';
import { formatGoodPriceMenu, formatGoodPriceSummary, formatMarketFloor, groupMarketPins, hasMarketCoordinate, marketDisplayName, marketSourceBadges, marketZones, matchesMarketStore, normalizeMarketName, sectionMatchLabel, visibleMarketStores, zoneIds } from './marketView';
import type { MarketStoreSearch } from './useMarketStoreSearch';
import MarketMenuDetails from './MarketMenuDetails';

export function marketListStores(market: MarketResponse, query: string, zoneId: number | null, viewport: MarketViewport | null, selectedKey: string | null, includeOutside: boolean, dishes: MarketDish[] = [], search?: MarketStoreSearch) {
  const zone = marketZones(market, includeOutside, zoneId).zones.find(zone => zone.id === zoneId);
  const stores = visibleMarketStores(market.stores, includeOutside, zone ? zoneIds(zone) : undefined);
  const searching = normalizeMarketName(query).length > 0;
  const keys: string[] = selectedKey?.startsWith('cluster:') ? JSON.parse(selectedKey.slice(8)) : selectedKey ? [selectedKey] : [];
  const selected = new Set(groupMarketPins(stores).filter(pin => keys.includes(pin.key)).flatMap(pin => pin.stores));
  const bounds = viewport?.bounds;
  const engine = search?.status === 'engine';
  const rows = stores.filter(store => searching ? engine ? store.id != null && search.storeIds.includes(store.id) : matchesMarketStore(store, query, dishes) != null : !bounds || !hasMarketCoordinate(store) || (store.latitude >= bounds.south && store.latitude <= bounds.north && store.longitude >= bounds.west && store.longitude <= bounds.east));
  rows.sort((a, b) => engine ? search.storeIds.indexOf(a.id!) - search.storeIds.indexOf(b.id!) : Number(hasMarketCoordinate(b)) - Number(hasMarketCoordinate(a)) || Number(selected.has(b)) - Number(selected.has(a)) || (matchesMarketStore(a, query, dishes)?.rank ?? 5) - (matchesMarketStore(b, query, dishes)?.rank ?? 5) || a.name.localeCompare(b.name, 'ko') || (a.id ?? 0) - (b.id ?? 0));
  return { rows, selected, searching };
}

/** The same list instance serves the mobile sheet and desktop panel. */
export default function MarketList({ market, query, zoneId, viewport, selectedKey, focusStore, includeOutside, lang, onFocusStore, dishes = [], search }: {
  focusStore?: number | null; market: MarketResponse; query: string; zoneId: number | null; viewport: MarketViewport | null; selectedKey: string | null; includeOutside: boolean; lang: PlaceLang; dishes?: MarketDish[]; search?: MarketStoreSearch; onFocusStore: (id: number) => void;
}) {
  const en = lang === 'en';
  const { rows, selected, searching } = marketListStores(market, query, zoneId, viewport, selectedKey, includeOutside, dishes, search);
  const match = (store: MarketResponse['stores'][number]) => search?.status === 'engine' ? search.matchedBy.get(store.id!) ?? null : matchesMarketStore(store, query, dishes);
  const resetKey = JSON.stringify([market.market.contentId, query, zoneId, viewport, includeOutside, selectedKey]);
  const [page, setPage] = useState({ key: resetKey, limit: 50 });
  const limit = page.key === resetKey ? page.limit : 50;
  // 좌표 없는 가게는 목록 끝에 남기되 「현 지도에서」 수에는 넣지 않는다 — 지도에 없는 것을 지도 안이라 세지 않는다.
  const unplaced = rows.filter(store => !hasMarketCoordinate(store)).length;
  const placed = rows.length - unplaced;
  const heading = searching
    ? (en ? `Found ${rows.length} shops` : `찾은 가게 ${rows.length}곳`)
    : (en ? `${placed} shops in current map` : `현 지도에서 ${placed}곳`) + (unplaced ? (en ? ` · ${unplaced} without map location` : ` · 지도 위치 없음 ${unplaced}곳`) : '');
  return <>
    <header className="market-list-header">
      <h2>{heading}</h2>
      {market.market.goodPrice && <p className="place-market-source">{formatGoodPriceSummary(market.market.goodPrice, lang)} · <a href={market.market.goodPrice.attribution.url} target="_blank" rel="noreferrer">{market.market.goodPrice.attribution.name}</a></p>}
      {market.market.attribution && <p className="place-market-source"><a href={market.market.attribution.url} target="_blank" rel="noreferrer">{market.market.attribution.name}</a> · {market.market.attribution.license}</p>}
      {(market.attribution ?? []).map(credit => <p className="place-market-source" key={credit}>{credit}</p>)}
    </header>
    <div className="market-list-body">
      {rows.length === 0 && <p>{en ? 'No shops to display in this area.' : '이 구역에 표시할 가게가 없습니다.'}</p>}
      <ul className="place-market-shops market-list-rows">
        {rows.slice(0, limit).map((store, index) => <li key={store.id ?? `${store.name}-${index}`} data-selected={selected.has(store) || store.id === focusStore || undefined} data-found={searching || undefined} data-outside={store.membership === 'OUT' || undefined}>
          {hasMarketCoordinate(store) && store.id != null ? <button type="button" aria-pressed={store.id === focusStore} aria-label={`${en ? 'Show on map' : '지도에서 보기'}: ${store.name}`} onClick={() => onFocusStore(store.id!)}><strong>{marketDisplayName(store, lang)}</strong></button> : <strong>{marketDisplayName(store, lang)}</strong>}
          <div className="place-market-badges">
            {selected.has(store) && <span>{en ? 'Selected parcel' : '선택한 필지'}</span>}
            {store.goodPrice && <span className="place-market-good-price-badge">{en ? 'Good price' : '착한가격'}</span>}
            {sectionMatchLabel(match(store), lang) && <span data-related={search?.status !== 'engine' && matchesMarketStore(store, query, dishes)?.matchedBy === 'related' || undefined}>{sectionMatchLabel(match(store), lang)}</span>}
            {marketSourceBadges(store, lang).map(badge => <span key={badge}>{badge}</span>)}
            {store.nearby ? <span>{en ? 'Nearby · Membership unconfirmed' : '주변 · 소속 미확인'}</span> : store.membership === 'OUT' && <span>{en ? 'Outside market' : '시장 밖'}</span>}
            {store.membership === 'UNKNOWN' && <span>{en ? 'Location unconfirmed' : '위치 미확인'}</span>}
            {!hasMarketCoordinate(store) && <span>{en ? 'No map location' : '지도 위치 없음'}</span>}
          </div>
          {store.goodPrice && store.goodPrice.menus.length > 0 && <p className="place-market-good-price-menus">{(selected.has(store) ? store.goodPrice.menus : store.goodPrice.menus.slice(0, 2)).map(menu => formatGoodPriceMenu(menu, lang)).join(' · ')}</p>}
          <MarketMenuDetails store={store} lang={lang} />
          <p>{[store.roadAddress || store.jibunAddress, store.buildingName, store.dong, formatMarketFloor(store.floor, lang), store.ho].filter(Boolean).join(' · ')}</p>
          {store.pinKind === 'REFERENCE' && <p>{[store.relativePosition, store.positionNote].filter(Boolean).join(' · ')}</p>}
        </li>)}
      </ul>
      {rows.length > limit && <button type="button" onClick={() => setPage({ key: resetKey, limit: limit + 50 })}>{en ? 'Show more' : '더 보기'}</button>}
    </div>
  </>;
}
