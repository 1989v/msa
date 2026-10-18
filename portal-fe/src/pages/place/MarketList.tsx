import type { MarketDish, MarketResponse } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import type { MarketViewport } from './MarketNaverMap';
import { formatGoodPriceMenu, formatGoodPriceSummary, formatMarketFloor, groupMarketPins, hasMarketCoordinate, marketDisplayName, marketSourceBadges, matchesMarketStore, normalizeMarketName, sectionMatchLabel, visibleMarketStores } from './marketView';
import type { MarketStoreSearch } from './useMarketStoreSearch';
import type { MarketStoreTypeKey } from './marketStoreType';
import MarketMenuDetails from './MarketMenuDetails';

export function marketListStores(market: MarketResponse, query: string, storeType: MarketStoreTypeKey | null, viewport: MarketViewport | null, selectedKey: string | null, includeOutside: boolean, dishes: MarketDish[] = [], search?: MarketStoreSearch) {
  const stores = visibleMarketStores(market.stores, includeOutside, storeType);
  const searching = normalizeMarketName(query).length > 0;
  const keys: string[] = selectedKey?.startsWith('cluster:') ? JSON.parse(selectedKey.slice(8)) : selectedKey ? [selectedKey] : [];
  const selected = new Set(groupMarketPins(stores).filter(pin => keys.includes(pin.key)).flatMap(pin => pin.stores));
  const bounds = viewport?.bounds;
  const engine = search?.status === 'engine';
  const rows = stores.filter(store => searching ? engine ? store.id != null && search.storeIds.includes(store.id) : matchesMarketStore(store, query, dishes) != null : !bounds || !hasMarketCoordinate(store) || (store.latitude >= bounds.south && store.latitude <= bounds.north && store.longitude >= bounds.west && store.longitude <= bounds.east));
  rows.sort((a, b) => engine ? search.storeIds.indexOf(a.id!) - search.storeIds.indexOf(b.id!) : Number(hasMarketCoordinate(b)) - Number(hasMarketCoordinate(a)) || Number(selected.has(b)) - Number(selected.has(a)) || (matchesMarketStore(a, query, dishes)?.rank ?? 5) - (matchesMarketStore(b, query, dishes)?.rank ?? 5) || a.name.localeCompare(b.name, 'ko') || (a.id ?? 0) - (b.id ?? 0));
  return { rows, selected, searching };
}
export type MarketListing = ReturnType<typeof marketListStores>;

/** The same list instance serves the mobile sheet and desktop panel. The page owns the rows, the page size and the
 * numbers so the map can show the same ordinals next to its pins. */
export default function MarketList({ market, listing, limit, numbers, query, focusStore, lang, dishes = [], search, onFocusStore, onOpenStore, onMore }: {
  market: MarketResponse; listing: MarketListing; limit: number; numbers: ReadonlyMap<number, number>; query: string; focusStore?: number | null;
  lang: PlaceLang; dishes?: MarketDish[]; search?: MarketStoreSearch;
  onFocusStore: (id: number) => void; onOpenStore: (id: number) => void; onMore: () => void;
}) {
  const en = lang === 'en';
  const { rows, selected, searching } = listing;
  const match = (store: MarketResponse['stores'][number]) => search?.status === 'engine' ? search.matchedBy.get(store.id!) ?? null : matchesMarketStore(store, query, dishes);
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
      {rows.length === 0 && <p>{en ? 'No shops to display' : '표시할 가게가 없습니다'}</p>}
      <ul className="place-market-shops market-list-rows">
        {rows.slice(0, limit).map((store, index) => {
          const number = store.id == null ? undefined : numbers.get(store.id);
          const name = marketDisplayName(store, lang);
          return <li key={store.id ?? `${store.name}-${index}`} data-selected={selected.has(store) || store.id === focusStore || undefined} data-found={searching || undefined} data-outside={store.membership === 'OUT' || undefined}>
            <div className="market-list-row-head">
              {number != null && <span className="market-list-no">{number}</span>}
              {hasMarketCoordinate(store) && store.id != null ? <button type="button" aria-pressed={store.id === focusStore} aria-label={`${en ? 'Show on map' : '지도에서 보기'}: ${name}`} onClick={() => onFocusStore(store.id!)}><strong>{name}</strong>{store.storeNo && <span className="market-store-no">{store.storeNo}</span>}</button> : <strong>{name}{store.storeNo && <span className="market-store-no">{store.storeNo}</span>}</strong>}
              {store.id != null && <button type="button" className="market-list-detail" aria-label={`${en ? 'Details' : '상세보기'}: ${name}`} onClick={() => onOpenStore(store.id!)}>{en ? 'Details' : '상세보기'}</button>}
            </div>
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
          </li>;
        })}
      </ul>
      {rows.length > limit && <button type="button" onClick={onMore}>{en ? 'Show more' : '더 보기'}</button>}
    </div>
  </>;
}
