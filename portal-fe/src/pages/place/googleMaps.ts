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

/**
 * 구글맵 "여기서 보기" 링크 (Maps URLs API — 키·쿼터 불요).
 *
 * 좌표 질의(`query={lat},{lng}`)는 맨 핀에 떨어져 리뷰·사진·영업시간이 없는 화면이 된다.
 * place_id 가 있으면 `query_place_id=` 로 장소 카드에 바로 착지한다 (query 는 폴백 표시용 필수).
 * 보강이 점진이라 3단 폴백이다: place_id → 이름+주소 검색 → 좌표.
 */
export function googleMapsSearchUrl(a: {
  title: string;
  googlePlaceId?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
}): string {
  const base = 'https://www.google.com/maps/search/?api=1';
  const placeId = (a.googlePlaceId ?? '').trim();
  if (placeId) {
    return `${base}&query=${encodeURIComponent(a.title)}&query_place_id=${encodeURIComponent(placeId)}`;
  }
  const address = (a.address ?? '').trim();
  if (address) return `${base}&query=${encodeURIComponent(`${a.title} ${address}`)}`;
  return `${base}&query=${a.latitude},${a.longitude}`;
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

/**
 * 선택된 명소와 함께 지도 프레임에 넣을 가까운 이웃 (ADR-0070).
 *
 * 선택한 한 점만 확대하면 "여기가 어디 옆인지"가 사라져 지도가 목록의 장식이 된다.
 * 그래서 가장 가까운 몇 곳을 같은 프레임에 넣어 bounds 를 만든다.
 */
export function neighboursInFrame<T extends { id: string; latitude: number; longitude: number }>(
  target: T,
  all: T[],
  count: number,
): T[] {
  if (count <= 0) return [];
  return all
    .filter((a) => a.id !== target.id)
    .map((a) => ({ a, km: haversineKm(target.latitude, target.longitude, a.latitude, a.longitude) }))
    .sort((x, y) => x.km - y.km)
    .slice(0, count)
    .map(({ a }) => a);
}

/**
 * 좌표에 가장 가까운 지역 (ADR-0071 §3). 중심 좌표 최근접이라 경계 폴리곤이 필요 없다 —
 * "지금 어느 시도에 있나"는 그 정도 정밀도로 충분하고, 경계 GeoJSON 은 free-tier 에서
 * 전송 비용을 다시 계산해야 하는 무게다.
 *
 * 첫 진입 자동 선택과 드릴다운 정렬이 **같은 함수**를 쓴다 — 둘이 다른 시도를 가리키면
 * 화면이 스스로 모순된다.
 */
export function nearestRegion<T extends { code: string; latitude: number | null; longitude: number | null }>(
  regions: T[],
  lat: number,
  lng: number,
): T | null {
  let best: { region: T; km: number } | null = null;
  for (const region of regions) {
    if (region.latitude == null || region.longitude == null) continue;
    const km = haversineKm(lat, lng, region.latitude, region.longitude);
    if (!best || km < best.km) best = { region, km };
  }
  return best?.region ?? null;
}
