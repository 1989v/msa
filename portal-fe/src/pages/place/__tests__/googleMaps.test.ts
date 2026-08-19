import { describe, expect, it } from 'vitest';
import { haversineKm, neighboursInFrame, radiusFromBounds } from '../googleMaps';

type P = { id: string; latitude: number; longitude: number };

// 실좌표 — 경복궁 기준으로 가까운 순: 광화문(≈0.3km) · 창덕궁(≈1.5km) · 남산(≈2.9km) · 해운대(≈325km)
const GYEONGBOK: P = { id: '1', latitude: 37.5788, longitude: 126.977 };
const GWANGHWAMUN: P = { id: '2', latitude: 37.5759, longitude: 126.9769 };
const CHANGDEOK: P = { id: '3', latitude: 37.5794, longitude: 126.991 };
const NAMSAN: P = { id: '4', latitude: 37.5512, longitude: 126.9882 };
const HAEUNDAE: P = { id: '5', latitude: 35.1587, longitude: 129.1604 };

describe('neighboursInFrame', () => {
  const all = [GYEONGBOK, HAEUNDAE, NAMSAN, CHANGDEOK, GWANGHWAMUN];

  it('가까운 순으로 count 개만 돌려준다', () => {
    expect(neighboursInFrame(GYEONGBOK, all, 3).map((a) => a.id)).toEqual(['2', '3', '4']);
  });

  it('자기 자신은 이웃이 아니다', () => {
    expect(neighboursInFrame(GYEONGBOK, all, 5).map((a) => a.id)).not.toContain('1');
  });

  it('요청 수가 목록보다 많으면 있는 만큼만 돌려준다', () => {
    expect(neighboursInFrame(GYEONGBOK, all, 99)).toHaveLength(4);
  });

  it('count 가 0 이하면 빈 배열 — 선택한 곳만 프레임에 남는다', () => {
    expect(neighboursInFrame(GYEONGBOK, all, 0)).toEqual([]);
  });

  it('목록에 자기 자신뿐이면 빈 배열', () => {
    expect(neighboursInFrame(GYEONGBOK, [GYEONGBOK], 3)).toEqual([]);
  });
});

describe('haversineKm', () => {
  it('서울–부산이 대략 325km 로 나온다', () => {
    expect(haversineKm(37.5788, 126.977, 35.1587, 129.1604)).toBeGreaterThan(300);
    expect(haversineKm(37.5788, 126.977, 35.1587, 129.1604)).toBeLessThan(350);
  });

  it('같은 점은 0', () => {
    expect(haversineKm(37.5788, 126.977, 37.5788, 126.977)).toBe(0);
  });
});

describe('radiusFromBounds', () => {
  const bounds = (neLat: number, neLng: number, cLat: number, cLng: number) => ({
    getNorthEast: () => ({ lat: () => neLat, lng: () => neLng }),
    getCenter: () => ({ lat: () => cLat, lng: () => cLng }),
  });

  it('아주 좁은 화면도 0.5km 아래로 내려가지 않는다 — 반경 0 은 결과를 0건으로 만든다', () => {
    expect(radiusFromBounds(bounds(37.5789, 126.9771, 37.5788, 126.977))).toBe(0.5);
  });

  it('전국이 보여도 50km 를 넘지 않는다', () => {
    expect(radiusFromBounds(bounds(38.6, 129.5, 36.5, 127.8))).toBe(50);
  });
});
