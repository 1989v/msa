import { useEffect, useRef, useState } from 'react';
import type { MarketDish, MarketStore } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import { formatGoodPriceMenu, formatMarketFloor, marketSourceBadges, matchesMarketName, marketDisplayName, sectionMatchLabel, matchesMarketStore } from './marketView';
import MarketMenuDetails from './MarketMenuDetails';

const floorNumber = (value: MarketStore['floor']) => {
  const raw = String(value ?? '');
  const number = Number(raw.match(/\d+/u)?.[0] ?? 0);
  return /^(?:B|지하|-)/iu.test(raw) ? -number : number;
};
const natural = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '', 'ko', { numeric: true });
function orderStores(stores: MarketStore[]) {
  return [...stores].sort((a, b) => natural(a.buildingName, b.buildingName) || natural(a.dong, b.dong)
    || floorNumber(a.floor) - floorNumber(b.floor) || natural(a.ho, b.ho) || natural(a.name, b.name));
}


export default function MarketClusterSheet({ stores, selectedKey, focusStoreId, onSelect, lang, query, dishes = [] }: {
  stores: MarketStore[]; selectedKey: string; focusStoreId?: number | null;
  onSelect: (key: string | null) => void; lang: PlaceLang; query: string; dishes?: MarketDish[];
}) {
  const en = lang === 'en';
  const [page, setPage] = useState({ key: '', count: 50 });
  const focusedRowRef = useRef<HTMLLIElement>(null);
  const ordered = orderStores(stores);
  const focusedIndex = focusStoreId == null ? -1 : ordered.findIndex((store) => store.id === focusStoreId);
  const limit = ordered.length > 200 ? Math.max(page.key === selectedKey ? page.count : 50,
    focusedIndex < 0 ? 0 : Math.ceil((focusedIndex + 1) / 50) * 50) : ordered.length;
  useEffect(() => {
    if (focusStoreId != null) focusedRowRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [focusStoreId, selectedKey, limit]);
  return <section className="place-market-cluster-sheet" aria-label={en ? 'Selected shops' : '선택한 가게'}>
      <h3>{en ? 'Shops on this parcel' : '같은 필지 가게'} ({ordered.length})</h3>
      <button type="button" onClick={() => onSelect(null)}>{en ? 'Show all shops' : '전체 가게 보기'}</button>
      <ul className="place-market-shops">{ordered.slice(0, limit).map((store, index) => <li key={store.id ?? index} ref={focusStoreId != null && store.id === focusStoreId ? focusedRowRef : undefined}
        data-selected={focusStoreId != null && store.id === focusStoreId || undefined}
        style={focusStoreId != null && store.id === focusStoreId ? { outline: '2px solid var(--ko-accent-text)', outlineOffset: '-2px' } : undefined}
        data-found={matchesMarketName(store, query, dishes) || undefined}>
        <strong>{marketDisplayName(store, lang)}</strong>
        <div className="place-market-badges">
          {store.goodPrice && <span>{en ? 'Good price' : '착한가격'}</span>}
          {matchesMarketName(store, query, dishes) && <span data-related={matchesMarketStore(store, query, dishes)?.matchedBy === 'related' || undefined}>{sectionMatchLabel(matchesMarketStore(store, query, dishes), lang)}</span>}
          {marketSourceBadges(store, lang).map((badge) => <span key={badge}>{badge}</span>)}
          {store.membership === 'OUT' && <span>{en ? 'Outside market' : '시장 밖'}</span>}
        </div>
        {store.goodPrice && store.goodPrice.menus.length > 0 && <p>{store.goodPrice.menus.map((menu) => formatGoodPriceMenu(menu, lang)).join(' · ')}</p>}
        <MarketMenuDetails store={store} lang={lang} />
        <p>{[store.roadAddress || store.jibunAddress, store.buildingName, store.dong, formatMarketFloor(store.floor, lang), store.ho].filter(Boolean).join(' · ')}</p>
        {store.pinKind === 'REFERENCE' && <p>{[store.relativePosition, store.positionNote].filter(Boolean).join(' · ')}</p>}
      </li>)}</ul>
      {limit < ordered.length && <button type="button" onClick={() => setPage({ key: selectedKey, count: limit + 50 })}>{en ? 'Show more' : '더 보기'}</button>}
    </section>;
}
