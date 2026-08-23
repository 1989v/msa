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

/**
 * Google encoded polyline 디코더 (정밀도 5).
 *
 * Maps JS 의 geometry 라이브러리를 부르지 않는 이유는 로더 URL 을 건드려야 하고, 그러면
 * 이 기능 때문에 다른 화면의 번들이 같이 커지기 때문이다. 알고리즘은 20줄이다.
 */
export function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
