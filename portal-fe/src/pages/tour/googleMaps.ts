/* eslint-disable @typescript-eslint/no-explicit-any */
// Google Maps JS API 로더 (ADR-0065). 키는 빌드타임 VITE_GOOGLE_MAPS_KEY —
// 브라우저 노출 공개값이며 콘솔의 HTTP referrer 제한 + 쿼터 캡으로 보호한다.
// 키 미주입 시 지도 없이 리스트-only 로 동작한다 (호출부 폴백).

declare global {
  interface Window {
    google?: any;
  }
}

let loading: Promise<any> | null = null;

export function mapsApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) ?? '';
}

export function loadGoogleMaps(): Promise<any> {
  const key = mapsApiKey();
  if (!key) return Promise.reject(new Error('VITE_GOOGLE_MAPS_KEY not set'));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&language=${document.documentElement.lang || 'ko'}`;
    script.async = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => {
      loading = null;
      reject(new Error('Google Maps JS 로드 실패'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** 지도 bounds 로부터 재검색 반경(km) 추정 — 중심~모서리 거리, 0.5~50 캡. */
export function radiusFromBounds(bounds: any): number {
  const ne = bounds.getNorthEast();
  const center = bounds.getCenter();
  const km = haversineKm(center.lat(), center.lng(), ne.lat(), ne.lng());
  return Math.min(50, Math.max(0.5, Math.round(km * 10) / 10));
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
