import { useEffect, useRef, useState } from 'react';
import type { MarketStore } from '../../api/marketApi';
import { clusterByScreenDistance } from './marketView';

type Coordinate = { latitude: number; longitude: number };
export type MarketNaverMapProps = {
  contentId: string;
  lang: 'ko' | 'en';
  centre: Coordinate;
  boundary?: [number, number][];
  pins: (Coordinate & { key: string; count: number; color: string; label: string; stores?: MarketStore[]; matched?: boolean })[];
  labels?: (Coordinate & { text: string })[];
  focusStoreId?: number | null;
  onSelect?: (key: string) => void;
  onError?: () => void;
  userPosition?: Coordinate & { accuracy: number };
  keyId: string;
};

type MapInstance = {
  destroy(): void; setCenter(position: unknown): void; panTo(position: unknown): void; setZoom(zoom: number): void;
  getProjection(): { fromCoordToOffset(position: unknown): { x: number; y: number } };
};
type Overlay = { setMap(map: MapInstance | null): void };
type MapsSdk = {
  Map: new (element: HTMLElement, options: { center: unknown; zoom: number; scaleControl: boolean; mapTypeControl: boolean; zoomControl: boolean }) => MapInstance;
  LatLng: new (latitude: number, longitude: number) => unknown;
  Marker: new (options: { map: MapInstance; position: unknown; title: string; icon: { content: HTMLElement; anchor: { x: number; y: number } } }) => Overlay;
  Event: { addListener(target: MapInstance, event: string, callback: () => void): unknown; removeListener(listener: unknown): void };
  Circle: new (options: { map: MapInstance; center: unknown; radius: number; strokeColor: string; fillColor: string; fillOpacity: number; strokeWeight: number }) => Overlay;
  Polyline: new (options: { map: MapInstance; path: unknown[]; strokeColor: string; strokeWeight: number }) => Overlay;
};
const currentSdk = () => typeof window === 'undefined' ? undefined : (window as Window & { naver?: { maps?: MapsSdk } }).naver?.maps;
const sdkLanguages = new WeakMap<MapsSdk, 'ko' | 'en'>();
const sdkLoads = new WeakMap<HTMLScriptElement, Promise<MapsSdk>>();

/** Keep the SDK for subsequent toggles; each mounted view owns its map only. */
function loadSdk(keyId: string, lang: 'ko' | 'en'): Promise<MapsSdk> {
  const maps = currentSdk();
  if (maps && (!sdkLanguages.has(maps) || sdkLanguages.get(maps) === lang)) return Promise.resolve(maps);
  let script = document.querySelector<HTMLScriptElement>('script[src^="https://oapi.map.naver.com/openapi/v3/maps.js"]');
  if (script && new URL(script.src).searchParams.get('language') !== lang) { script.remove(); script = null; }
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
      if (sdk) { sdkLanguages.set(sdk, lang); resolve(sdk); }
      else { element.remove(); reject(new Error('Naver Maps SDK unavailable')); }
    };
    const onError = () => { finish(); element.remove(); reject(new Error('Naver Maps SDK load failed')); };
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

function pinIcon(color: string, label: string, count?: number, matched = false): HTMLElement {
  const icon = document.createElement('span');
  icon.setAttribute('aria-label', label);
  icon.textContent = count == null ? '' : String(count);
  Object.assign(icon.style, {
    display: 'grid', placeItems: 'center', boxSizing: 'border-box',
    width: count == null ? '0.75rem' : '2rem', height: count == null ? '0.75rem' : '2rem',
    borderRadius: '50%', borderStyle: 'solid', borderWidth: matched ? '3px' : '2px',
    borderColor: matched ? 'var(--ko-accent-text)' : 'var(--ko-surface-0)',
    background: color.startsWith('--') ? `var(${color})` : color,
    color: 'var(--ko-surface-0)', fontSize: 'var(--ko-text-base)', fontWeight: '700',
    fontVariantNumeric: 'tabular-nums', transform: 'translate(-50%, -50%)',
  });
  return icon;
}

export default function MarketNaverMap({ contentId, lang, centre, boundary, pins, userPosition, keyId, labels = [], focusStoreId, onSelect, onError }: MarketNaverMapProps) {
  const host = useRef<HTMLDivElement>(null);
  const identity = JSON.stringify([contentId, keyId, lang]);
  const [ready, setReady] = useState<{ identity: string; map: MapInstance; sdk: MapsSdk } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const appliedFocus = useRef<string | null>(null);
  const errorRef = useRef(onError);
  errorRef.current = onError;
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
      map = new sdk.Map(host.current, { center: new sdk.LatLng(initialCentre.current.latitude, initialCentre.current.longitude), zoom: 17, scaleControl: true, mapTypeControl: false, zoomControl: true });
      setReady({ identity, map, sdk });
    }).catch(() => { if (!disposed) { setFailed(identity); errorRef.current?.(); } });
    return () => { disposed = true; map?.destroy(); };
  }, [identity, keyId, lang]);

  useEffect(() => {
    if (!keyId || ready?.identity !== identity) return;
    ready.map.setCenter(new ready.sdk.LatLng(latitude, longitude));
  }, [ready, identity, keyId, latitude, longitude]);

  useEffect(() => {
    if (focusStoreId == null) { appliedFocus.current = null; return; }
    if (!keyId || ready?.identity !== identity) return;
    const pin = pins.find((pin) => pin.stores?.some((store) => store.id === focusStoreId));
    if (!pin) return;
    const request = JSON.stringify([identity, focusStoreId, pin.latitude, pin.longitude]);
    if (appliedFocus.current === request) return;
    appliedFocus.current = request;
    ready.map.panTo(new ready.sdk.LatLng(pin.latitude, pin.longitude));
    ready.map.setZoom(19);
    onSelect?.(pin.key);
  }, [ready, identity, keyId, focusStoreId, pins, onSelect]);

  useEffect(() => {
    if (!keyId || ready?.identity !== identity) return;
    const { sdk, map } = ready;
    let markers: Overlay[] = [];
    const drawPins = () => {
      markers.forEach((marker) => marker.setMap(null));
      const projection = map.getProjection();
      const projected = pins.map((pin) => ({ ...pin,
        ...projection.fromCoordToOffset(new sdk.LatLng(pin.latitude, pin.longitude)), stores: pin.stores ?? [],
      }));
      const clusters = clusterByScreenDistance(projected, 1, 24);
      markers = clusters.map((pin) => {
        const members = pins.filter((member) => pin.parcelKeys.includes(member.key));
        const label = members.map((member) => member.label).join(', ');
        const icon = pinIcon(pin.color, label, members.reduce((sum, member) => sum + member.count, 0), members.some((member) => member.matched));
        const button = document.createElement('button');
        button.type = 'button'; button.setAttribute('aria-label', label);
        button.className = 'place-market-naver-pin';
        icon.style.transform = 'none';
        button.appendChild(icon);
        button.onclick = () => onSelect?.(pin.key);
        return new sdk.Marker({ map, position: new sdk.LatLng(pin.latitude, pin.longitude), title: label,
          icon: { content: button, anchor: { x: 0, y: 0 } } });
      });
    };
    drawPins();
    const listeners = ['zoom_changed', 'idle'].map((event) => sdk.Event.addListener(map, event, drawPins));
    return () => { listeners.forEach((listener) => sdk.Event.removeListener(listener)); markers.forEach((marker) => marker.setMap(null)); };
  }, [ready, identity, keyId, pins, onSelect]);

  useEffect(() => {
    if (!keyId || ready?.identity !== identity) return;
    const { sdk, map } = ready;
    const token = (name: string) => getComputedStyle(host.current!).getPropertyValue(name).trim();
    const overlays: Overlay[] = [];
    if (boundary && boundary.length > 1) overlays.push(new sdk.Polyline({
      map, path: [...boundary, boundary[0]].map(([lat, lng]) => new sdk.LatLng(lat, lng)),
      strokeColor: token('--ko-text-muted'), strokeWeight: 2,
    }));
    for (const label of labels) {
      const content = document.createElement('span');
      content.className = 'place-market-naver-label'; content.textContent = label.text;
      overlays.push(new sdk.Marker({ map, position: new sdk.LatLng(label.latitude, label.longitude), title: label.text,
        icon: { content, anchor: { x: 0, y: 0 } } }));
    }
    if (userPosition) {
      const label = lang === 'en' ? 'Your location' : '내 위치';
      const position = new sdk.LatLng(userPosition.latitude, userPosition.longitude);
      overlays.push(new sdk.Circle({ map, center: position, radius: userPosition.accuracy,
        strokeColor: token('--ko-accent-primary'), fillColor: token('--ko-accent-primary'), fillOpacity: 0.15, strokeWeight: 1 }));
      overlays.push(new sdk.Marker({ map, position, title: label,
        icon: { content: pinIcon('var(--ko-accent-primary)', label), anchor: { x: 0, y: 0 } } }));
    }
    return () => { overlays.forEach((overlay) => overlay.setMap(null)); };
  }, [ready, identity, keyId, boundary, userPosition, lang, labels]);

  if (!keyId) return null;
  return <div role="group" aria-label={lang === 'en' ? 'Naver shop location map' : '네이버 가게 위치 지도'}>
    <div ref={host} style={{ width: '100%', aspectRatio: '600 / 440', minHeight: '20rem' }} />
    {failed === identity && <p role="alert">{lang === 'en' ? 'Unable to load Naver Map. Turn off Naver Map to use the shop map.' : '네이버 지도를 불러오지 못했습니다. 네이버 지도 보기를 끄고 가게 지도를 이용하세요.'}</p>}
  </div>;
}
