import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { NAVER_MAP_KEY_ID } from '../../seo/copy.mjs';
import MarketCanvas from './MarketCanvas';
import MarketNaverMap, { type MarketViewport } from './MarketNaverMap';
import MarketGoogleMap from './MarketGoogleMap';
import MarketLocate from './MarketLocate';
import { buildMarketOverlay } from './marketOverlay';
import { matchesMarketStore, type MarketUserPosition } from './marketView';

const PREFERENCE = 'market-map-provider';

/** Selection keys are shared across live engines, the SVG view and the dedicated list. */
export default function MarketMap(props: ComponentProps<typeof MarketCanvas> & {
  onViewportChange?: (viewport: MarketViewport | null) => void;
  contentId: string;
  /** List ordinals (store id → 1-based) shown on lone pins and name labels. */
  numbers?: ReadonlyMap<number, number>;
  onOpenStore?: (id: number) => void;
  onShowList?: () => void;
}) {
  const { contentId, data, lang, points, query, dishes, selectedKey, focusStoreId, onSelect, numbers, onOpenStore, onShowList } = props;
  const [provider, setProvider] = useState(() => {
    try { return typeof window !== 'undefined' && window.localStorage.getItem(PREFERENCE) === 'canvas' ? 'canvas' : 'naver'; }
    catch { return 'naver'; }
  });
  const [failed, setFailed] = useState<'naver' | 'google' | null>(null);
  const [position, setPosition] = useState<MarketUserPosition | null>(null);
  const live = typeof window !== 'undefined' && provider !== 'canvas' && failed !== 'google';
  const naver = Boolean(NAVER_MAP_KEY_ID) && failed !== 'naver';
  const storeIds = useMemo(() => points.flatMap((p) => p.stores.map((s) => s.id)), [points]);
  const selection = useMemo(() => ({ storeId: focusStoreId, selectedKey, numbers,
    searchStoreIds: props.searchStoreIds ?? data.stores.filter((s) => matchesMarketStore(s, query, dishes)).flatMap((s) => s.id == null ? [] : [s.id]),
  }), [props.searchStoreIds, data.stores, query, dishes, focusStoreId, selectedKey, numbers]);
  // 중심만 필요하지만 모델 전체(묶음 포함)를 계산하므로 응답이 바뀔 때만 다시 센다.
  const centre = useMemo(() => buildMarketOverlay({ data, zoom: 17 }).centre, [data]);
  useEffect(() => { if (!live || !centre) props.onViewportChange?.(null); }, [live, centre, props.onViewportChange]);
  const toggle = () => {
    const next = live ? 'canvas' : 'naver';
    setProvider(next); setFailed(null);
    try { window.localStorage.setItem(PREFERENCE, next); } catch { /* Storage is optional. */ }
  };
  const liveProps = { contentId, data, lang, selection, storeIds, userPosition: position, onSelect, onOpenStore, onShowList, onViewportChange: props.onViewportChange };
  return <>
    {typeof window !== 'undefined' && <button type="button" className="place-market-provider" onClick={toggle}>{live
      ? (lang === 'en' ? 'Use our map' : '우리 지도로 보기')
      : (lang === 'en' ? 'Use Naver Map' : '네이버 지도로 보기')}</button>}
    {live && centre ? <div className="place-market-canvas-layout">
      <div>
        {naver ? <MarketNaverMap {...liveProps} keyId={NAVER_MAP_KEY_ID} onError={() => setFailed('naver')} />
          : <MarketGoogleMap {...liveProps} onError={() => setFailed('google')} />}
        <MarketLocate data={data} lang={lang} onPosition={setPosition} />
      </div>

    </div> : <MarketCanvas {...props} userPosition={position} onPosition={setPosition} />}
  </>;
}
