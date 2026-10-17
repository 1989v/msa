/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import type { MarketResponse } from '../../api/marketApi';
import { buildMarketOverlay, type MarketBounds, type OverlayMarker, type OverlaySelection } from './marketOverlay';

export type MarketViewport = { bounds: MarketBounds; zoom: number };
export type MarketLiveMapProps = {
  contentId: string; lang: 'ko' | 'en'; data: MarketResponse;
  interactive?: boolean; initialZoom?: number; onActivate?: () => void;
  selection?: OverlaySelection; storeIds?: (number | null)[];
  userPosition?: { latitude: number; longitude: number; accuracy: number } | null;
  onViewportChange?: (viewport: MarketViewport) => void;
  onSelect?: (key: string) => void; onZoneSelect?: (id: number | null) => void; onError?: () => void;
};
export type MarketNaverMapProps = MarketLiveMapProps & { keyId: string };
const currentSdk = () => typeof window === 'undefined' ? undefined : (window as Window & { naver?: { maps?: any } }).naver?.maps;
const sdkLanguages = new WeakMap<any, 'ko' | 'en'>();
const sdkLoads = new WeakMap<HTMLScriptElement, Promise<any>>();

/** Keep the SDK for subsequent toggles; each mounted view owns its map only. */
function loadSdk(keyId: string, lang: 'ko' | 'en'): Promise<any> {
  const maps = currentSdk();
  if (maps && (!sdkLanguages.has(maps) || sdkLanguages.get(maps) === lang)) return Promise.resolve(maps);
  let script = document.querySelector<HTMLScriptElement>('script[src^="https://oapi.map.naver.com/openapi/v3/maps.js"]');
  if (script && new URL(script.src).searchParams.get('language') !== lang) { script.remove(); script = null; }
  if (script && sdkLoads.has(script)) return sdkLoads.get(script)!;
  const append = !script;
  script ??= document.createElement('script');
  const element = script;
  const loaded = new Promise<any>((resolve, reject) => {
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

const authFailures = new Set<() => void>();
function registerAuthFailure(callback: () => void) {
  authFailures.add(callback);
  (window as any).navermap_authFailure = () => { authFailures.forEach((fail) => fail()); };
  return () => { authFailures.delete(callback); };
}

/** HTML uses textContent, including store names supplied by merchants. */
function pinIcon(marker: OverlayMarker): HTMLElement {
  const button = document.createElement('button'); button.type = 'button';
  button.className = 'place-market-naver-pin'; button.setAttribute('aria-label', marker.title);
  const icon = document.createElement('span'); icon.textContent = marker.label ? '' : marker.text;
  Object.assign(icon.style, { display: 'grid', placeItems: 'center', boxSizing: 'border-box',
    width: `${marker.size}px`, height: `${marker.size}px`, borderRadius: '50%', borderStyle: 'solid',
    borderWidth: `${marker.strokeWeight}px`, borderColor: marker.strokeColor, background: marker.color,
    color: marker.textColor, fontSize: 'var(--ko-text-base)', fontWeight: '700' });
  button.appendChild(icon);
  if (marker.label) { const label = document.createElement('span'); label.textContent = marker.text; label.className = 'place-market-naver-label'; label.style.color = marker.textColor; Object.assign(label.style, { position: 'absolute', left: '50%', top: '50%', transform: `translate(calc(-50% + ${marker.labelOffset.x}px), calc(-50% + ${marker.labelOffset.y}px))` }); button.appendChild(label); }
  return button;
}

export default function MarketNaverMap(props: MarketNaverMapProps) {
  const { contentId, lang, keyId, interactive = true, initialZoom = 17 } = props;
  const host = useRef<HTMLDivElement>(null); const latest = useRef(props); latest.current = props;
  const identity = JSON.stringify([contentId, keyId, lang, interactive, initialZoom]);
  const [ready, setReady] = useState<{ identity: string; map: any; sdk: any } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const redraw = useRef<(reportViewport?: boolean) => void>(() => {}); const appliedFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!keyId || !host.current) return;
    let disposed = false; let map: any; let errorReported = false; let observer: ResizeObserver | undefined;
    const fail = () => { if (!disposed && !errorReported) { errorReported = true; setFailed(identity); latest.current.onError?.(); } };
    const unregister = registerAuthFailure(fail);
    loadSdk(keyId, lang).then((sdk) => {
      if (disposed || errorReported || !host.current) return;
      const centre = buildMarketOverlay({ ...latest.current, zoom: initialZoom }).centre;
      if (!centre) return;
      const canObserve = typeof ResizeObserver !== 'undefined';
      const create = () => {
        if (map || disposed || !host.current) return;
        const r = host.current.getBoundingClientRect();
        // 상자 크기가 0 인 채로 만들면 기본 크기로 굳는다 — 크기가 잡힌 뒤에 만들고 그 크기를 넘긴다(크기를 지켜볼 수 없는 환경에선 바로 만든다).
        const sized = r.width >= 1 && r.height >= 1;
        if (!sized && canObserve) return;
        map = new sdk.Map(host.current, { center: new sdk.LatLng(centre.latitude, centre.longitude), zoom: initialZoom, ...(sized && sdk.Size ? { size: new sdk.Size(Math.round(r.width), Math.round(r.height)) } : {}), scaleControl: interactive, mapTypeControl: false, zoomControl: interactive, ...(!interactive ? { draggable: false, scrollWheel: false, pinchZoom: false, keyboardShortcuts: false, disableDoubleClickZoom: true } : {}) });
        setReady({ identity, map, sdk });
      };
      // 카드·시트·회전으로 상자가 바뀌면 지도에 새 크기를 알린다. 아직 못 만들었으면 그때 만든다.
      if (canObserve) {
        observer = new ResizeObserver(() => {
          if (!map) { create(); return; }
          const r = host.current?.getBoundingClientRect();
          if (r && r.width > 0 && r.height > 0 && sdk.Size) { map.setSize?.(new sdk.Size(Math.round(r.width), Math.round(r.height))); sdk.Event?.trigger?.(map, 'resize'); }
        });
        observer.observe(host.current);
      }
      create();
    }).catch(fail);
    return () => { disposed = true; unregister(); observer?.disconnect(); map?.destroy(); };
  }, [identity, keyId, lang, initialZoom, interactive]);

  useEffect(() => {
    if (!keyId || ready?.identity !== identity) return;
    const { sdk, map } = ready;
    const overlays = new Map<string, { signature: string; object: any; listener?: any }>();
    const token = (color: string) => { const name = /^var\((--[\w-]+)\)$/.exec(color)?.[1]; return name ? getComputedStyle(host.current!).getPropertyValue(name).trim() : color; };
    const coord = (p: { latitude: number; longitude: number }) => new sdk.LatLng(p.latitude, p.longitude);
    const remove = (entry: { object: any; listener?: any }) => { if (entry.listener != null) sdk.Event.removeListener(entry.listener); entry.object.setMap(null); };
    redraw.current = (reportViewport = false) => {
      const bounds = map.getBounds?.(); const ne = bounds?.getNE(); const sw = bounds?.getSW();
      const frame: MarketBounds | undefined = ne && sw ? { north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() } : undefined;
      const input = latest.current;
      const zoom = Math.round(map.getZoom?.() ?? initialZoom);
      const model = buildMarketOverlay({ ...input, zoom, bounds: frame });
      if (interactive && reportViewport && frame) input.onViewportChange?.({ bounds: frame, zoom });
      const wanted = new Set<string>();
      const sync = (key: string, value: unknown, create: () => any, click?: () => void) => {
        wanted.add(key); const signature = JSON.stringify(value); const old = overlays.get(key);
        if (old?.signature === signature) return;
        if (old) remove(old);
        const object = create(); const listener = click ? sdk.Event.addListener(object, 'click', click) : undefined;
        overlays.set(key, { signature, object, listener });
      };
      for (const shape of [model.marketPolygon, ...model.zonePolygons].filter((shape) => shape != null)) sync(shape.key, shape, () => new sdk.Polygon({ map, paths: shape.coordinates.map(([lat, lng]) => new sdk.LatLng(lat, lng)), fillColor: token(shape.color), fillOpacity: shape.fillOpacity, strokeColor: token(shape.color), strokeWeight: shape.strokeWeight, strokeOpacity: shape.strokeOpacity }), !interactive ? () => latest.current.onActivate?.() : shape.zoneId != null ? () => latest.current.onZoneSelect?.(shape.zoneId) : undefined);
      for (const line of model.alleys) sync(line.key, line, () => new sdk.Polyline({ map, path: line.coordinates.map(([lat, lng]) => new sdk.LatLng(lat, lng)), strokeColor: token(line.color), strokeWeight: line.strokeWeight, strokeOpacity: line.strokeOpacity }), !interactive ? () => latest.current.onActivate?.() : line.zoneId != null ? () => latest.current.onZoneSelect?.(line.zoneId) : undefined);
      for (const marker of model.markers) sync(marker.key, marker, () => {
        const content = pinIcon(marker); content.onclick = () => { if (!interactive) latest.current.onActivate?.(); else if (marker.selectionKey) latest.current.onSelect?.(marker.selectionKey); };
        return new sdk.Marker({ map, position: coord(marker), title: marker.title, icon: { content, anchor: { x: 0, y: 0 } } });
      });
      for (const label of model.labels) sync(label.key, label, () => {
        const content = document.createElement('span'); content.textContent = label.text; content.className = 'place-market-naver-label'; content.style.color = label.color;
        return new sdk.Marker({ map, position: coord(label), title: label.text, icon: { content, anchor: { x: 0, y: 0 } } });
      }, !interactive ? () => latest.current.onActivate?.() : label.zoneId != null ? () => latest.current.onZoneSelect?.(label.zoneId) : undefined);
      if (model.userPosition) {
        const user = model.userPosition;
        sync('user-accuracy', user, () => new sdk.Circle({ map, center: coord(user), radius: user.accuracy, strokeColor: token(user.color), fillColor: token(user.color), fillOpacity: user.fillOpacity, strokeWeight: user.strokeWeight }));
        sync('user', user, () => new sdk.Marker({ map, position: coord(user), title: user.text, icon: { content: pinIcon({ ...user, key: 'user', text: '', title: user.text, storeIds: [], textColor: user.strokeColor, labelOffset: { x: 0, y: 0 }, highlighted: false, searchMatch: false, label: false }), anchor: { x: 0, y: 0 } } }));
      }
      for (const [key, entry] of overlays) if (!wanted.has(key)) { remove(entry); overlays.delete(key); }
      if (!interactive || !model.focus) appliedFocus.current = null;
      else {
        const request = JSON.stringify([identity, model.focus]);
        if (appliedFocus.current !== request) { appliedFocus.current = request; map.panTo(coord(model.focus)); map.setZoom(model.focus.zoom); latest.current.onSelect?.(model.focus.selectionKey); }
      }
    };
    redraw.current(true);
    const listeners = ['zoom_changed', 'idle', 'bounds_changed'].map((event) => sdk.Event.addListener(map, event, () => redraw.current(event === 'idle')));
    return () => { redraw.current = () => {}; listeners.forEach((listener) => sdk.Event.removeListener(listener)); overlays.forEach(remove); };
  }, [ready, identity, keyId, initialZoom, interactive]);
  useEffect(() => { redraw.current(); }, [props.data, props.selection, props.storeIds, props.userPosition]);
  if (!keyId) return null;
  return <div role="group" aria-label={lang === 'en' ? 'Naver shop location map' : '네이버 가게 위치 지도'}>
    <div ref={host} style={{ width: '100%', aspectRatio: interactive ? '600 / 440' : '16 / 9', minHeight: interactive ? '20rem' : undefined }} />
    {failed === identity && <p role="alert">{lang === 'en' ? 'Unable to load Naver Map.' : '네이버 지도를 불러오지 못했습니다.'}</p>}
  </div>;
}
