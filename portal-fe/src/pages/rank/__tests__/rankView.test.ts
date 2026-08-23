import { describe, expect, it } from 'vitest';
import { capturedLabel, decodePolyline, formatPrice, movementLabel, movementTone } from '../rankView';

describe('등락 표기', () => {
  it('신규 진입은 NEW 로, 변동 없음과 구분한다', () => {
    // NEW 를 "—" 로 뭉개면 처음 순위에 든 것이 가장 안 보이게 된다
    expect(movementLabel({ type: 'NEW', places: null })).toBe('NEW');
    expect(movementLabel({ type: 'SAME', places: null })).toBe('—');
    expect(movementTone({ type: 'NEW', places: null })).not.toBe(movementTone({ type: 'SAME', places: null }));
  });

  it('오르내림은 기호와 칸 수를 함께 적는다 — 색만으로 구분하지 않는다', () => {
    expect(movementLabel({ type: 'UP', places: 3 })).toBe('▲3');
    expect(movementLabel({ type: 'DOWN', places: 1 })).toBe('▼1');
  });
});

describe('가격 표기', () => {
  it('천 단위를 끊고, 값이 없으면 대시다', () => {
    expect(formatPrice(1658)).toBe('1,658');
    expect(formatPrice(null)).toBe('—');
    expect(formatPrice(undefined)).toBe('—');
  });
});

describe('기준 시각', () => {
  it('날짜까지만 적는다 — 시각은 매일 같은 값이라 노이즈다', () => {
    expect(capturedLabel('2026-08-23T02:00:00Z')).toMatch(/8월 23일 기준/);
  });

  it('값이 없거나 깨졌으면 표기하지 않는다', () => {
    expect(capturedLabel(null)).toBeNull();
    expect(capturedLabel('not-a-date')).toBeNull();
  });
});

describe('폴리라인 디코더', () => {
  it('구글 문서의 표준 예시를 그대로 푼다', () => {
    // 기대값은 Google Maps Platform 문서가 명시한 것 — 우리 코드가 만든 값이 아니다
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(points).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('빈 문자열은 빈 경로다', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});
