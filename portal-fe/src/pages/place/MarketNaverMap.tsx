/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import type { MarketResponse, MarketStore } from '../../api/marketApi';
import { buildMarketOverlay, MARKET_DETAIL_ZOOM, marketFitZoom, type MarketBounds, type OverlayMarker, type OverlaySelection } from './marketOverlay';
import { marketDisplayName } from './marketView';
import { MARKET_STORE_TYPES, marketStoreType } from './marketStoreType';

export type MarketViewport = { bounds: MarketBounds; zoom: number };
export type MarketLiveMapProps = {
  contentId: string; lang: 'ko' | 'en'; data: MarketResponse;
  interactive?: boolean; initialZoom?: number; onActivate?: () => void;
  selection?: OverlaySelection; storeIds?: (number | null)[];
  userPosition?: { latitude: number; longitude: number; accuracy: number } | null;
  onViewportChange?: (viewport: MarketViewport) => void;
  onSelect?: (key: string) => void; onError?: () => void;
  /** Info window actions: open or close one shop's detail panel (`openStoreId` is the one open); closing the window clears the selection.
   * `onShowList` is for maps with no list beside them — the rest of a group then links to one. */
  onOpenStore?: (id: number) => void; openStoreId?: number | null; onDeselect?: () => void; onShowList?: () => void;
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

/** 핀 버튼 한 변(px). 마우스는 SDK 의 이벤트 레이어가 받아 아이콘 상자로 핀을 찾으므로, 상자(size·anchor)와 버튼이 같은 자리여야 한다. */
const PIN_BOX = 44;
/** 정보 창에 이름을 늘어놓는 상한. 더 많으면 목록으로 보낸다. */
const INFO_LIMIT = 3;
/** Info window body: up to three shops (list order, with their list numbers) with a detail toggle each, then how many more.
 * Beside a list the rest are already there, so the window only counts them; without one it links to the list. Text only — merchants write the names. */
function infoContent(stores: MarketStore[], numbers: ReadonlyMap<number, number> | undefined, openStoreId: number | null | undefined, lang: 'ko' | 'en', on: { close: () => void; open: (id: number) => void; list?: () => void }): HTMLElement {
  const en = lang === 'en';
  const root = document.createElement('div'); root.className = 'place-market-naver-info'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', en ? 'Selected shops' : '선택한 가게');
  const close = document.createElement('button'); close.type = 'button'; close.className = 'place-market-naver-info-close'; close.setAttribute('aria-label', en ? 'Close' : '닫기'); close.textContent = '×'; close.onclick = on.close; root.appendChild(close);
  for (const store of stores.slice(0, INFO_LIMIT)) {
    const name = marketDisplayName(store, lang);
    const row = document.createElement('div'); row.className = 'place-market-naver-info-row';
    const title = document.createElement('strong');
    const number = store.id == null ? undefined : numbers?.get(store.id);
    if (number != null) { const badge = document.createElement('span'); badge.className = 'market-list-no'; badge.textContent = String(number); title.appendChild(badge); }
    title.appendChild(document.createTextNode(name));
    if (store.storeNo) { const tag = document.createElement('span'); tag.className = 'market-store-no'; tag.textContent = store.storeNo; title.appendChild(tag); }
    row.appendChild(title);
    const type = MARKET_STORE_TYPES.find((candidate) => candidate.key === marketStoreType(store));
    const meta = document.createElement('p'); meta.textContent = [type?.[lang], store.roadAddress || store.jibunAddress].filter(Boolean).join(' · '); row.appendChild(meta);
    if (store.id != null) { const id = store.id; const open = id === openStoreId; const detail = document.createElement('button'); detail.type = 'button'; detail.textContent = open ? (en ? 'Close' : '상세 닫기') : (en ? 'Details' : '상세보기'); detail.setAttribute('aria-expanded', String(open)); detail.setAttribute('aria-label', `${detail.textContent}: ${name}`); detail.onclick = () => on.open(id); row.appendChild(detail); }
    root.appendChild(row);
  }
  const rest = stores.length - INFO_LIMIT;
  if (rest > 0 && on.list) { const more = document.createElement('button'); more.type = 'button'; more.className = 'place-market-naver-info-more'; more.textContent = en ? `${rest} more · Show list` : `외 ${rest}곳 · 목록 보기`; more.onclick = on.list; root.appendChild(more); }
  else if (rest > 0) { const more = document.createElement('p'); more.className = 'place-market-naver-info-more'; more.textContent = en ? `${rest} more in the list` : `외 ${rest}곳은 목록에`; root.appendChild(more); }
  return root;
}
const pinHtmlIcon = (content: HTMLElement) => ({ content, size: { width: PIN_BOX, height: PIN_BOX }, anchor: { x: PIN_BOX / 2, y: PIN_BOX / 2 } });
/** HTML uses textContent, including store names supplied by merchants. */
function pinIcon(marker: OverlayMarker): HTMLElement {
  const button = document.createElement('button'); button.type = 'button';
  button.className = 'place-market-naver-pin'; button.setAttribute('aria-label', marker.title);
  button.style.width = button.style.height = `${PIN_BOX}px`;
  const icon = document.createElement('span'); icon.textContent = marker.text;
  Object.assign(icon.style, { display: 'grid', placeItems: 'center', boxSizing: 'border-box',
    width: `${marker.size}px`, height: `${marker.size}px`, borderRadius: '50%', borderStyle: 'solid',
    borderWidth: `${marker.strokeWeight}px`, borderColor: marker.strokeColor, background: marker.color,
    color: marker.textColor, fontSize: marker.fontSize, fontWeight: '700' });
  button.appendChild(icon);
  if (marker.label && marker.labelText) { const label = document.createElement('span'); label.textContent = marker.labelText; label.className = 'place-market-naver-label'; label.style.color = marker.labelColor ?? marker.textColor; Object.assign(label.style, { position: 'absolute', left: '50%', top: '50%', transform: `translate(calc(-50% + ${marker.labelOffset.x}px), calc(-50% + ${marker.labelOffset.y}px))` }); button.appendChild(label); }
  return button;
}

export default function MarketNaverMap(props: MarketNaverMapProps) {
  const { contentId, lang, keyId, interactive = true, initialZoom } = props;
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
      const centre = buildMarketOverlay({ ...latest.current, zoom: MARKET_DETAIL_ZOOM }).centre;
      if (!centre) return;
      const canObserve = typeof ResizeObserver !== 'undefined';
      const create = () => {
        if (map || disposed || !host.current) return;
        const r = host.current.getBoundingClientRect();
        // 상자 크기가 0 인 채로 만들면 기본 크기로 굳는다 — 크기가 잡힌 뒤에 만들고 그 크기를 넘긴다(크기를 지켜볼 수 없는 환경에선 바로 만든다).
        const sized = r.width >= 1 && r.height >= 1;
        if (!sized && canObserve) return;
        map = new sdk.Map(host.current, { center: new sdk.LatLng(centre.latitude, centre.longitude), zoom: initialZoom ?? marketFitZoom(latest.current.data, r.width, r.height), ...(sized && sdk.Size ? { size: new sdk.Size(Math.round(r.width), Math.round(r.height)) } : {}), scaleControl: interactive, mapTypeControl: false, zoomControl: interactive, ...(!interactive ? { draggable: false, scrollWheel: false, pinchZoom: false, keyboardShortcuts: false, disableDoubleClickZoom: true } : {}) });
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
    // 핀 클릭·목록 포커스 때 핀 자리에 간단 정보. 위치 기준으로 열어 핀이 다시 그려져도 남고, 지도 빈 곳·×·선택 해제로 닫힌다.
    const info = interactive && sdk.InfoWindow ? new sdk.InfoWindow({ content: document.createElement('div'), borderWidth: 0, backgroundColor: 'transparent', disableAnchor: true, pixelOffset: { x: 0, y: -(PIN_BOX / 2 + 4) } }) : null;
    // 열린 창의 가게들과 그때 쓴 번호 Map·열린 상세. 번호는 클릭 뒤 페이지가 다시 그릴 때 오므로, 둘 중 하나가 바뀌면 같은 창을 목록 순서·번호로 다시 채운다.
    let shown: { storeIds: (number | null)[]; at: { latitude: number; longitude: number } } | null = null; let shownNumbers: ReadonlyMap<number, number> | undefined; let shownOpen: number | null | undefined;
    // 선택 해제는 「있다가 없어질 때」만 본다. 클릭 직후 지도 이벤트(panBy 의 bounds_changed 등)가 페이지보다 먼저 다시 그리면 선택 키가 아직 옛 값(null)이라, 값만 보면 방금 연 창을 닫아 버린다.
    let lastSelectedKey: string | null = latest.current.selection?.selectedKey ?? null;
    // 창을 닫으면 선택도 푼다 — 목록이 선택한 곳만 보이다가 시장 전체로 돌아간다.
    const closeInfo = () => { info?.close(); shown = null; latest.current.onDeselect?.(); };
    const fillInfo = () => {
      if (!info || !shown) return false;
      const current = latest.current; const numbers = current.selection?.numbers;
      const stores = shown.storeIds.flatMap((id) => { const store = current.data.stores.find((s) => s.id === id); return store ? [store] : []; });
      if (!stores.length) return false;
      const rank = (store: MarketStore) => (store.id == null ? undefined : numbers?.get(store.id)) ?? Number.MAX_SAFE_INTEGER;
      shownNumbers = numbers; shownOpen = current.openStoreId;
      info.setContent(infoContent([...stores].sort((a, b) => rank(a) - rank(b)), numbers, current.openStoreId, current.lang, { close: closeInfo, open: (id) => latest.current.onOpenStore?.(id), list: current.onShowList && (() => latest.current.onShowList?.()) }));
      return true;
    };
    const openInfo = (storeIds: (number | null)[], at: { latitude: number; longitude: number }) => {
      if (!info) return;
      shown = { storeIds, at };
      if (!fillInfo()) { shown = null; return; }
      info.open(map, coord(at));
      // 창이 지도 위·옆으로 넘치면 그만큼 지도를 옮긴다(네이버 InfoWindow 는 스스로 비켜 주지 않는다). 핀이 화면 가장자리에 있으면 창이 잘려 닫기·상세 버튼이 안 보인다.
      const point = map.getProjection?.()?.fromCoordToOffset?.(coord(at)); const content = info.getContent?.() as HTMLElement | undefined; const box = map.getSize?.();
      if (point && content) {
        const up = Math.max(0, content.offsetHeight + PIN_BOX / 2 + 16 - point.y);
        const left = point.x - content.offsetWidth / 2 - 8; const right = box ? point.x + content.offsetWidth / 2 + 8 - box.width : 0;
        const side = left < 0 ? left : right > 0 ? right : 0;
        if (up > 0 || side !== 0) map.panBy?.(sdk.Point ? new sdk.Point(side, -up) : { x: side, y: -up });
      }
    };
    const mapClick = info ? sdk.Event.addListener(map, 'click', () => { if (info.getMap?.()) closeInfo(); }) : undefined;
    redraw.current = (reportViewport = false) => {
      const bounds = map.getBounds?.(); const ne = bounds?.getNE(); const sw = bounds?.getSW();
      const frame: MarketBounds | undefined = ne && sw ? { north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() } : undefined;
      const input = latest.current;
      const zoom = Math.round(map.getZoom?.() ?? initialZoom ?? MARKET_DETAIL_ZOOM);
      const model = buildMarketOverlay({ ...input, zoom, bounds: frame });
      if (interactive && reportViewport && frame) input.onViewportChange?.({ bounds: frame, zoom });
      const selectedKey = input.selection?.selectedKey ?? null;
      if (selectedKey == null && lastSelectedKey != null) { info?.close(); shown = null; }
      else if (selectedKey != null && shown && info?.getMap?.() && (input.selection?.numbers !== shownNumbers || input.openStoreId !== shownOpen)) fillInfo();
      lastSelectedKey = selectedKey;
      const wanted = new Set<string>();
      const sync = (key: string, value: unknown, create: () => any, click?: () => void) => {
        wanted.add(key); const signature = JSON.stringify(value); const old = overlays.get(key);
        if (old?.signature === signature) return;
        if (old) remove(old);
        const object = create(); const listener = click ? sdk.Event.addListener(object, 'click', click) : undefined;
        overlays.set(key, { signature, object, listener });
      };
      for (const shape of [model.marketPolygon].filter((shape) => shape != null)) sync(shape.key, shape, () => new sdk.Polygon({ map, paths: shape.coordinates.map(([lat, lng]) => new sdk.LatLng(lat, lng)), fillColor: token(shape.color), fillOpacity: shape.fillOpacity, strokeColor: token(shape.color), strokeWeight: shape.strokeWeight, strokeOpacity: shape.strokeOpacity }), !interactive ? () => latest.current.onActivate?.() : undefined);
      for (const line of model.alleys) sync(line.key, line, () => new sdk.Polyline({ map, path: line.coordinates.map(([lat, lng]) => new sdk.LatLng(lat, lng)), strokeColor: token(line.color), strokeWeight: line.strokeWeight, strokeOpacity: line.strokeOpacity }), !interactive ? () => latest.current.onActivate?.() : undefined);
      // 터치는 핀 버튼에 닿지만 마우스는 SDK 이벤트 레이어에서 멈춘다 — 버튼 onclick 과 SDK marker click 둘 다 건다(한 동작은 한쪽만 받는다).
      for (const marker of model.markers) {
        const select = () => { if (!interactive) latest.current.onActivate?.(); else if (marker.selectionKey) { latest.current.onSelect?.(marker.selectionKey); openInfo(marker.storeIds, marker); } };
        sync(marker.key, marker, () => {
          const content = pinIcon(marker); content.onclick = select;
          return new sdk.Marker({ map, position: coord(marker), title: marker.title, icon: pinHtmlIcon(content) });
        }, !interactive || marker.selectionKey ? select : undefined);
      }
      for (const label of model.labels) sync(label.key, label, () => {
        const content = document.createElement('span'); content.textContent = label.text; content.className = 'place-market-naver-label'; content.style.color = label.color;
        return new sdk.Marker({ map, position: coord(label), title: label.text, icon: { content, anchor: { x: 0, y: 0 } } });
      }, !interactive ? () => latest.current.onActivate?.() : undefined);
      if (model.userPosition) {
        const user = model.userPosition;
        sync('user-accuracy', user, () => new sdk.Circle({ map, center: coord(user), radius: user.accuracy, strokeColor: token(user.color), fillColor: token(user.color), fillOpacity: user.fillOpacity, strokeWeight: user.strokeWeight }));
        sync('user', user, () => new sdk.Marker({ map, position: coord(user), title: user.text, icon: pinHtmlIcon(pinIcon({ ...user, key: 'user', text: '', title: user.text, storeIds: [], textColor: user.strokeColor, fontSize: 'var(--ko-text-xs)', labelOffset: { x: 0, y: 0 }, highlighted: false, searchMatch: false, label: false })) }));
      }
      for (const [key, entry] of overlays) if (!wanted.has(key)) { remove(entry); overlays.delete(key); }
      if (!interactive || !model.focus) appliedFocus.current = null;
      else {
        const request = JSON.stringify([identity, model.focus]);
        if (appliedFocus.current !== request) { appliedFocus.current = request; map.panTo(coord(model.focus)); map.setZoom(model.focus.zoom); latest.current.onSelect?.(model.focus.selectionKey); openInfo([input.selection?.storeId ?? null], model.focus); }
      }
    };
    redraw.current(true);
    const listeners = ['zoom_changed', 'idle', 'bounds_changed'].map((event) => sdk.Event.addListener(map, event, () => redraw.current(event === 'idle')));
    return () => { redraw.current = () => {}; listeners.forEach((listener) => sdk.Event.removeListener(listener)); if (mapClick != null) sdk.Event.removeListener(mapClick); info?.close(); overlays.forEach(remove); };
  }, [ready, identity, keyId, initialZoom, interactive]);
  useEffect(() => { redraw.current(); }, [props.data, props.selection, props.storeIds, props.userPosition, props.openStoreId]);
  if (!keyId) return null;
  return <div role="group" aria-label={lang === 'en' ? 'Naver shop location map' : '네이버 가게 위치 지도'}>
    <div ref={host} style={{ width: '100%', aspectRatio: interactive ? '600 / 440' : '16 / 9', minHeight: interactive ? '20rem' : undefined }} />
    {failed === identity && <p role="alert">{lang === 'en' ? 'Unable to load Naver Map.' : '네이버 지도를 불러오지 못했습니다.'}</p>}
  </div>;
}
