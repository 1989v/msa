/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { buildMarketOverlay, type MarketBounds } from './marketOverlay';
import type { MarketLiveMapProps } from './MarketNaverMap';
import { loadGoogleMaps } from './googleMaps';

const authFailures = new Set<() => void>();
let previousAuthFailure: (() => void) | undefined;
const reportAuthFailure = () => { authFailures.forEach((fail) => fail()); previousAuthFailure?.(); };
function registerAuthFailure(callback: () => void) {
  const global = window as Window & { gm_authFailure?: () => void };
  if (global.gm_authFailure !== reportAuthFailure) { previousAuthFailure = global.gm_authFailure; global.gm_authFailure = reportAuthFailure; }
  authFailures.add(callback);
  return () => {
    authFailures.delete(callback);
    if (!authFailures.size && global.gm_authFailure === reportAuthFailure) {
      if (previousAuthFailure) global.gm_authFailure = previousAuthFailure;
      else delete global.gm_authFailure;
      previousAuthFailure = undefined;
    }
  };
}

export default function MarketGoogleMap(props: MarketLiveMapProps) {
  const { contentId, lang } = props;
  const host = useRef<HTMLDivElement>(null); const latest = useRef(props); latest.current = props;
  const identity = JSON.stringify([contentId, lang]);
  const [ready, setReady] = useState<{ identity: string; map: any; sdk: any } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const redraw = useRef<() => void>(() => {}); const appliedFocus = useRef<string | null>(null);
  useEffect(() => {
    if (!host.current) return;
    let disposed = false; let map: any; let errorReported = false;
    const fail = () => { if (!disposed && !errorReported) { errorReported = true; setFailed(identity); latest.current.onError?.(); } };
    const unregister = registerAuthFailure(fail);
    loadGoogleMaps().then((sdk) => {
      if (disposed || errorReported || !host.current) return;
      const centre = buildMarketOverlay({ ...latest.current, zoom: 17 }).centre;
      if (!centre) return;
      map = new sdk.Map(host.current, { center: { lat: centre.latitude, lng: centre.longitude }, zoom: 17, clickableIcons: false, streetViewControl: false, mapTypeControl: false });
      setReady({ identity, map, sdk });
    }).catch(fail);
    return () => { disposed = true; unregister(); map?.unbindAll?.(); };
  }, [identity, lang]);

  useEffect(() => {
    if (ready?.identity !== identity) return;
    const { sdk, map } = ready;
    const overlays = new Map<string, { signature: string; object: any; listener?: any }>();
    const token = (color: string) => { const name = /^var\((--[\w-]+)\)$/.exec(color)?.[1]; return name ? getComputedStyle(host.current!).getPropertyValue(name).trim() : color; };
    const coord = (p: { latitude: number; longitude: number }) => ({ lat: p.latitude, lng: p.longitude });
    const remove = (entry: { object: any; listener?: any }) => { if (entry.listener != null) sdk.event.removeListener(entry.listener); entry.object.setMap(null); };
    redraw.current = () => {
      const bounds = map.getBounds?.(); const ne = bounds?.getNorthEast(); const sw = bounds?.getSouthWest();
      const frame: MarketBounds | undefined = ne && sw ? { north: ne.lat(), east: ne.lng(), south: sw.lat(), west: sw.lng() } : undefined;
      const input = latest.current;
      const model = buildMarketOverlay({ ...input, zoom: Math.round(map.getZoom?.() ?? 17), bounds: frame });
      const wanted = new Set<string>();
      const sync = (key: string, value: unknown, create: () => any, click?: () => void) => {
        wanted.add(key); const signature = JSON.stringify(value); const old = overlays.get(key);
        if (old?.signature === signature) return;
        if (old) remove(old);
        const object = create(); const listener = click ? sdk.event.addListener(object, 'click', click) : undefined;
        overlays.set(key, { signature, object, listener });
      };
      for (const shape of [model.marketPolygon, ...model.zonePolygons].filter((shape) => shape != null)) sync(shape.key, shape, () => new sdk.Polygon({ map, paths: shape.coordinates.map(([lat, lng]) => ({ lat, lng })), fillColor: token(shape.color), fillOpacity: shape.fillOpacity, strokeColor: token(shape.color), strokeWeight: shape.strokeWeight, strokeOpacity: shape.strokeOpacity }), shape.zoneId != null ? () => latest.current.onZoneSelect?.(shape.zoneId) : undefined);
      for (const line of model.alleys) sync(line.key, line, () => new sdk.Polyline({ map, path: line.coordinates.map(([lat, lng]) => ({ lat, lng })), strokeColor: token(line.color), strokeWeight: line.strokeWeight, strokeOpacity: line.strokeOpacity }), line.zoneId != null ? () => latest.current.onZoneSelect?.(line.zoneId) : undefined);
      for (const marker of model.markers) sync(marker.key, marker, () => new sdk.Marker({ map, position: coord(marker), title: marker.title,
        icon: { path: marker.iconPath, scale: 1, labelOrigin: new sdk.Point(marker.labelOffset.x, marker.labelOffset.y), fillColor: token(marker.color), fillOpacity: 1, strokeColor: token(marker.strokeColor), strokeWeight: marker.strokeWeight },
        label: { text: marker.text, color: token(marker.textColor), fontWeight: '700' },
      }), marker.selectionKey ? () => latest.current.onSelect?.(marker.selectionKey!) : undefined);
      for (const label of model.labels) sync(label.key, label, () => new sdk.Marker({ map, position: coord(label), title: label.text,
        icon: { path: sdk.SymbolPath.CIRCLE, scale: 0 }, label: { text: label.text, color: token(label.color) },
      }), label.zoneId != null ? () => latest.current.onZoneSelect?.(label.zoneId) : undefined);
      if (model.userPosition) {
        const user = model.userPosition;
        sync('user-accuracy', user, () => new sdk.Circle({ map, center: coord(user), radius: user.accuracy, strokeColor: token(user.color), fillColor: token(user.color), fillOpacity: user.fillOpacity, strokeWeight: user.strokeWeight }));
        sync('user', user, () => new sdk.Marker({ map, position: coord(user), title: user.text, icon: { path: user.iconPath, scale: 1, fillColor: token(user.color), fillOpacity: 1, strokeColor: token(user.strokeColor), strokeWeight: user.strokeWeight } }));
      }
      for (const [key, entry] of overlays) if (!wanted.has(key)) { remove(entry); overlays.delete(key); }
      if (!model.focus) appliedFocus.current = null;
      else {
        const request = JSON.stringify([identity, model.focus]);
        if (appliedFocus.current !== request) { appliedFocus.current = request; map.panTo(coord(model.focus)); map.setZoom(model.focus.zoom); latest.current.onSelect?.(model.focus.selectionKey); }
      }
    };
    redraw.current();
    const listeners = ['zoom_changed', 'idle', 'bounds_changed'].map((event) => sdk.event.addListener(map, event, () => redraw.current()));
    return () => { redraw.current = () => {}; listeners.forEach((listener) => sdk.event.removeListener(listener)); overlays.forEach(remove); };
  }, [ready, identity]);
  useEffect(() => { redraw.current(); }, [props.data, props.selection, props.storeIds, props.userPosition]);
  return <div role="group" aria-label={lang === 'en' ? 'Shop location map' : '가게 위치 지도'}>
    <div ref={host} style={{ width: '100%', aspectRatio: '600 / 440', minHeight: '20rem' }} />
    {failed === identity && <p role="alert">{lang === 'en' ? 'Unable to load map.' : '지도를 불러오지 못했습니다.'}</p>}
  </div>;
}
