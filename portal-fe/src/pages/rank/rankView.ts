import type { Movement } from '../../api/rankingApi';

/** 등락 배지 문구. NEW 를 "-" 로 뭉개면 처음 순위에 든 것이 가장 안 보이게 된다. */
export function movementLabel(movement: Movement): string {
  switch (movement.type) {
    case 'NEW':
      return 'NEW';
    case 'UP':
      return `▲${movement.places ?? ''}`;
    case 'DOWN':
      return `▼${movement.places ?? ''}`;
    default:
      return '—';
  }
}

export function movementTone(movement: Movement): string {
  switch (movement.type) {
    case 'NEW':
      return 'is-new';
    case 'UP':
      return 'is-up';
    case 'DOWN':
      return 'is-down';
    default:
      return 'is-same';
  }
}

export function formatPrice(value: number | null | undefined): string {
  return value == null ? '—' : Math.round(value).toLocaleString('ko-KR');
}

/** "2026-08-23T02:00:00Z" → "8월 23일 기준". 시각까지 적으면 매일 같은 값이라 노이즈다. */
export function capturedLabel(capturedAt: string | null): string | null {
  if (!capturedAt) return null;
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 기준`;
}

/** payload 의 숫자 필드를 안전하게 꺼낸다 — JSON 이라 타입이 보장되지 않는다. */
export function payloadNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * 구글맵 길찾기 링크 (Maps URLs API).
 *
 * **조립 링크라 키도 쿼터도 없다** — API 호출이 아니라 주소다. 경로 계산을 우리가 하려면
 * 요청마다 유료 API 를 불러야 하고, 출발지가 전국에 흩어지면 캐시도 듣지 않는다.
 * 길안내는 이미 잘하는 앱에 넘기고 우리는 "어디가 싼가"에 집중한다.
 *
 * 좌표를 먼저 쓴다 — 이름으로 찾게 하면 같은 상호의 다른 주유소로 안내될 수 있고,
 * 방금 본 가격과 다른 곳에 도착하는 것이 이 버튼의 유일한 실패 방식이다.
 */
export function googleMapsDirectionsUrl(station: {
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  roadAddress?: string | null;
}): string {
  const base = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=';
  if (station.latitude != null && station.longitude != null) {
    return `${base}${station.latitude},${station.longitude}`;
  }
  const address = (station.roadAddress ?? '').trim();
  return `${base}${encodeURIComponent(address ? `${station.name} ${address}` : station.name)}`;
}
