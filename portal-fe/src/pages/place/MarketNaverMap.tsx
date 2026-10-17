import { useEffect, useRef, useState } from 'react';

type Coordinate = { latitude: number; longitude: number };
export type MarketNaverMapProps = {
  contentId: string;
  lang: 'ko' | 'en';
  centre: Coordinate;
  boundary?: [number, number][];
  pins: (Coordinate & { key: string; count: number; color: string; label: string })[];
  userPosition?: Coordinate & { accuracy: number };
  keyId: string;
};

type MapInstance = { destroy(): void; setCenter(position: unknown): void };
type Overlay = { setMap(map: MapInstance | null): void };
type MapsSdk = {
  Map: new (element: HTMLElement, options: { center: unknown; zoom: number }) => MapInstance;
  LatLng: new (latitude: number, longitude: number) => unknown;
  Marker: new (options: { map: MapInstance; position: unknown; title: string; icon: { content: HTMLElement; anchor: { x: number; y: number } } }) => Overlay;
  Polyline: new (options: { map: MapInstance; path: unknown[]; strokeColor: string; strokeWeight: number }) => Overlay;
};
const currentSdk = () => (window as Window & { naver?: { maps?: MapsSdk } }).naver?.maps;
const sdkLoads = new WeakMap<HTMLScriptElement, Promise<MapsSdk>>();

/** Keep the SDK for subsequent toggles; each mounted view owns its map only. */
function loadSdk(keyId: string, lang: 'ko' | 'en'): Promise<MapsSdk> {
  const maps = currentSdk();
  if (maps) return Promise.resolve(maps);
  let script = document.querySelector<HTMLScriptElement>('script[src^="https://oapi.map.naver.com/openapi/v3/maps.js"]');
  if (script && sdkLoads.has(script)) return sdkLoads.get(script)!;
  const append = !script;
  script ??= document.createElement('script');
  const element = script;
  const loaded = new Promise<MapsSdk>((resolve, reject) => {
    const finish = () => {
      element.removeEventListener('load', onLoad);
      element.removeEventListener('error', onError);
    };
    const onLoad = () => {
      finish();
      const sdk = currentSdk();
      if (sdk) resolve(sdk);
      else reject(new Error('Naver Maps SDK unavailable'));
    };
    const onError = () => { finish(); reject(new Error('Naver Maps SDK load failed')); };
    element.addEventListener('load', onLoad);
    element.addEventListener('error', onError);
  });
  sdkLoads.set(element, loaded);
  if (append) {
    element.async = true;
    element.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(keyId)}&language=${lang}`;
    document.head.appendChild(element);
  }
  return loaded;
}

function pinIcon(color: string, label: string, count?: number): HTMLElement {
  const icon = document.createElement('span');
  icon.setAttribute('aria-label', label);
  icon.textContent = count == null ? '' : String(count);
  Object.assign(icon.style, {
    display: 'grid', placeItems: 'center', boxSizing: 'border-box',
    width: count == null ? '0.75rem' : '2rem', height: count == null ? '0.75rem' : '2rem',
    borderRadius: '50%', border: '2px solid var(--ko-surface-0)',
    background: color.startsWith('--') ? `var(${color})` : color,
    color: 'var(--ko-surface-0)', fontSize: 'var(--ko-text-base)', fontWeight: '700',
    fontVariantNumeric: 'tabular-nums', transform: 'translate(-50%, -50%)',
  });
  return icon;
}

export default function MarketNaverMap({ contentId, lang, centre, boundary, pins, userPosition, keyId }: MarketNaverMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const identity = JSON.stringify([contentId, keyId, lang]);
  const [ready, setReady] = useState<{ identity: string; map: MapInstance; sdk: MapsSdk } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const latitude = centre.latitude;
  const longitude = centre.longitude;
  // Initial centre is followed by the synchronization effect, including changes while loading.
  const initialCentre = useRef(centre);
  useEffect(() => {
    if (!keyId || !host.current) return;
    let disposed = false;
    let map: MapInstance | undefined;
    loadSdk(keyId, lang).then((sdk) => {
      if (disposed || !host.current) return;
      map = new sdk.Map(host.current, { center: new sdk.LatLng(initialCentre.current.latitude, initialCentre.current.longitude), zoom: 17 });
      setReady({ identity, map, sdk });
    }).catch(() => { if (!disposed) setFailed(identity); });
    return () => { disposed = true; map?.destroy(); };
  }, [identity, keyId, lang]);

  useEffect(() => {
    if (!keyId || ready?.identity !== identity) return;
    ready.map.setCenter(new ready.sdk.LatLng(latitude, longitude));
  }, [ready, identity, keyId, latitude, longitude]);

  useEffect(() => {
    if (!keyId || ready?.identity !== identity) return;
    const { sdk, map } = ready;
    const overlays: Overlay[] = pins.map((pin) => new sdk.Marker({
      map, position: new sdk.LatLng(pin.latitude, pin.longitude), title: pin.label,
      icon: { content: pinIcon(pin.color, pin.label, pin.count), anchor: { x: 0, y: 0 } },
    }));
    if (boundary && boundary.length > 1) overlays.push(new sdk.Polyline({
      map, path: boundary.map(([lat, lng]) => new sdk.LatLng(lat, lng)),
      strokeColor: getComputedStyle(host.current!).getPropertyValue('--ko-text-muted').trim(), strokeWeight: 2,
    }));
    if (userPosition) {
      const label = lang === 'en' ? 'Your location' : '내 위치';
      overlays.push(new sdk.Marker({ map, position: new sdk.LatLng(userPosition.latitude, userPosition.longitude), title: label,
        icon: { content: pinIcon('var(--ko-accent-primary)', label), anchor: { x: 0, y: 0 } } }));
    }
    return () => { overlays.forEach((overlay) => overlay.setMap(null)); };
  }, [ready, identity, keyId, pins, boundary, userPosition, lang]);

  if (!keyId) return null;
  return <div role="group" aria-label={lang === 'en' ? 'Naver shop location map' : '네이버 가게 위치 지도'}>
    <div ref={host} style={{ width: '100%', aspectRatio: '600 / 440', minHeight: '20rem' }} />
    {failed === identity && <p role="alert">{lang === 'en' ? 'Unable to load Naver Map. Turn off Naver Map to use the shop map.' : '네이버 지도를 불러오지 못했습니다. 네이버 지도 보기를 끄고 가게 지도를 이용하세요.'}</p>}
  </div>;
}
