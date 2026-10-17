import { useMemo, useState, type ComponentProps } from 'react';
import { NAVER_MAP_KEY_ID } from '../../seo/copy.mjs';
import MarketCanvas from './MarketCanvas';
import MarketNaverMap from './MarketNaverMap';
import MarketLocate from './MarketLocate';
import MarketClusterSheet from './MarketClusterSheet';
import { longestMarketSegmentMidpoint, marketDisplayName, matchesMarketStore, type MarketUserPosition } from './marketView';

const PREFERENCE = 'market-map-provider';

/** Both map providers keep the same selection keys, detail sheet and location guidance. */
export default function MarketMap(props: ComponentProps<typeof MarketCanvas> & { contentId: string }) {
  const { contentId, data, lang, points, projection, query, dishes, selectedKey, focusStoreId, onSelect, color, pathColor } = props;
  const [provider, setProvider] = useState(() => {
    try { return typeof window !== 'undefined' && window.localStorage.getItem(PREFERENCE) === 'canvas' ? 'canvas' : 'naver'; }
    catch { return 'naver'; }
  });
  const [failed, setFailed] = useState(false);
  const [position, setPosition] = useState<MarketUserPosition | null>(null);
  const canUseNaver = Boolean(NAVER_MAP_KEY_ID) && typeof window !== 'undefined';
  const naver = canUseNaver && provider === 'naver' && !failed;
  const pins = useMemo(() => points.map((pin) => ({ ...pin, count: pin.stores.length,
    label: `${lang === 'en' ? 'Shops on this parcel' : '같은 필지 가게'}: ${pin.stores.map((store) => marketDisplayName(store, lang)).join(', ')}`,
    color: pathColor(pin.stores[0].pathId) ?? (pin.stores.every((store) => store.membership === 'OUT' && !store.nearby)
      ? 'var(--ko-text-muted)' : color(pin.stores[0].zoneId)),
    matched: pin.stores.some((store) => matchesMarketStore(store, query, dishes)),
  })), [points, lang, pathColor, color, query, dishes]);
  const labels = useMemo(() => {
    const paths = new Map<string, { path: NonNullable<typeof data.paths>[number]; length: number }>();
    for (const path of data.paths ?? []) if (path.named && path.name && path.geometry.length > 1) {
      const projected = path.geometry.map(projection.project);
      const length = projected.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - projected[index].x, point.y - projected[index].y), 0);
      if (length > (paths.get(path.name)?.length ?? -1)) paths.set(path.name, { path, length });
    }
    return [...paths.values()].flatMap(({ path }) => {
      const midpoint = longestMarketSegmentMidpoint(path.geometry.map(([lat, lng]) => ({ x: lng, y: lat })));
      return midpoint ? [{ latitude: midpoint.y, longitude: midpoint.x, text: path.name! }] : [];
    });
  }, [data.paths, projection]);
  const polygon = data.boundary?.polygon ?? [];
  const coordinates = polygon.length ? polygon : points.length ? points.map((point) => [point.latitude, point.longitude])
    : (data.paths ?? []).flatMap((path) => path.geometry).concat((data.entrances ?? []).map((entry) => [entry.lat, entry.lng]));
  const centre = coordinates.length ? {
    latitude: (Math.min(...coordinates.map(([lat]) => lat)) + Math.max(...coordinates.map(([lat]) => lat))) / 2,
    longitude: (Math.min(...coordinates.map(([, lng]) => lng)) + Math.max(...coordinates.map(([, lng]) => lng))) / 2,
  } : null;
  const keys: string[] = selectedKey?.startsWith('cluster:') ? JSON.parse(selectedKey.slice(8)) : selectedKey ? [selectedKey] : [];
  const selectedStores = points.filter((point) => keys.includes(point.key)).flatMap((point) => point.stores);
  const toggle = () => {
    const next = naver ? 'canvas' : 'naver';
    setProvider(next); setFailed(false);
    try { window.localStorage.setItem(PREFERENCE, next); } catch { /* Storage is optional. */ }
  };
  return <>
    {canUseNaver && <button type="button" className="place-market-provider" onClick={toggle}>{naver
      ? (lang === 'en' ? 'Use our map' : '우리 지도로 보기')
      : (lang === 'en' ? 'Use Naver Map' : '네이버 지도로 보기')}</button>}
    {naver && centre ? <div className="place-market-canvas-layout">
      <div>
        <MarketNaverMap contentId={contentId} keyId={NAVER_MAP_KEY_ID} lang={lang} centre={centre} boundary={data.boundary?.polygon}
          pins={pins} labels={labels} focusStoreId={focusStoreId} userPosition={position ?? undefined} onSelect={onSelect} onError={() => setFailed(true)} />
        <MarketLocate data={data} lang={lang} onPosition={setPosition} />
      </div>
      {selectedKey != null && <MarketClusterSheet stores={selectedStores} selectedKey={selectedKey} focusStoreId={focusStoreId}
        onSelect={onSelect} lang={lang} query={query} dishes={dishes} />}
    </div> : <MarketCanvas {...props} userPosition={position} onPosition={setPosition} />}
  </>;
}
