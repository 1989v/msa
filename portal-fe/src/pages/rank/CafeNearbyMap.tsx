/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { loadGoogleMaps } from '../place/googleMaps';
import { cafeMetric } from './cafeView';
import type { CafeStore } from '../../api/rankingApi';

/** Only PUBLIC store positions are given to Google. User position never leaves the search POST. */
export default function CafeNearbyMap({ stores, basis }: { stores: CafeStore[]; basis: 'serving' | '100ml' }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    if (!stores.length) return;
    void loadGoogleMaps().then(sdk => {
      if (cancelled || !host.current) return;
      const map = new sdk.Map(host.current, { center: { lat: stores[0].latitude, lng: stores[0].longitude }, zoom: 15, mapTypeControl: false, streetViewControl: false, fullscreenControl: false });
      const bounds = new sdk.LatLngBounds();
      const markers = stores.map(store => {
        const position = { lat: store.latitude, lng: store.longitude }; bounds.extend(position);
        const sugar = store.selectedDrink ? cafeMetric(store.selectedDrink, 'sugar', basis) : null;
        const summary = `${store.brandName} ${store.branchName ?? ''} · 당류 ${sugar ? `${sugar.amount}${sugar.unit ?? ''}` : '선택 필요'}${basis === '100ml' ? '/100ml' : ''}`;
        return new sdk.Marker({ position, title: summary, label: { text: `${store.brandName.slice(0, 1)} ${sugar ? `${sugar.amount}${sugar.unit ?? ''}` : '선택 필요'}`, fontSize: '12px' } });
      });
      const cluster = new MarkerClusterer({ map, markers });
      if (stores.length > 1) map.fitBounds(bounds);
      cleanup = () => { cluster.clearMarkers(); markers.forEach(marker => marker.setMap(null)); sdk.event.clearInstanceListeners(map); map.unbindAll(); };
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; cleanup(); };
  }, [stores, basis]);
  return <><div className="cafe-nearby-map" ref={host} role="group" aria-label="매장 위치 지도" />{failed && <p role="alert">지도를 불러오지 못했습니다. 목록과 길찾기 링크를 이용해 주세요.</p>}<p className="cafe-note">현재 페이지의 공개 매장 위치만 지도에 표시합니다.</p></>;
}
