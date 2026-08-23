import { describe, expect, it } from 'vitest';
import {
  capturedLabel,
  formatPrice,
  googleMapsDirectionsUrl,
  movementLabel,
  movementTone,
  payloadNumber,
} from '../rankView';

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

describe('구글맵 길찾기 링크', () => {
  it('좌표가 있으면 좌표로 찍는다 — 같은 상호의 다른 주유소로 안내되면 안 된다', () => {
    const url = googleMapsDirectionsUrl({
      name: '경복궁셀프주유소',
      latitude: 37.5766,
      longitude: 126.9769,
      roadAddress: '서울 종로구 사직로 1',
    });
    expect(url).toContain('destination=37.5766,126.9769');
    expect(url).toContain('travelmode=driving');
  });

  it('좌표가 없으면 이름+주소로 넘긴다', () => {
    const url = googleMapsDirectionsUrl({
      name: '광화문주유소',
      latitude: null,
      longitude: null,
      roadAddress: '서울 종로구 새문안로 20',
    });
    expect(url).toContain(encodeURIComponent('광화문주유소 서울 종로구 새문안로 20'));
  });

  it('좌표도 주소도 없으면 이름만으로도 링크가 만들어진다', () => {
    expect(googleMapsDirectionsUrl({ name: '이름만' })).toContain(encodeURIComponent('이름만'));
  });
});

describe('payload 숫자 꺼내기', () => {
  it('숫자와 숫자 문자열을 모두 받는다 — JSON 이라 타입이 보장되지 않는다', () => {
    expect(payloadNumber({ latitude: 37.5 }, 'latitude')).toBe(37.5);
    expect(payloadNumber({ latitude: '37.5' }, 'latitude')).toBe(37.5);
  });

  it('없거나 숫자가 아니면 null 이다', () => {
    expect(payloadNumber({}, 'latitude')).toBeNull();
    expect(payloadNumber({ latitude: 'abc' }, 'latitude')).toBeNull();
    expect(payloadNumber({ latitude: null }, 'latitude')).toBeNull();
  });
});
