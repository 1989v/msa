import { describe, expect, it } from 'vitest';
import {
  googleMapsSearchUrl,
  haversineKm,
  nearestRegion,
  neighboursInFrame,
  radiusFromBounds,
} from '../googleMaps';

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

describe('googleMapsSearchUrl', () => {
  const base = { title: '경복궁', latitude: 37.5788, longitude: 126.977 };

  it('place_id 가 있으면 장소 카드 딥링크 — query 는 폴백 표시용으로 함께 싣는다', () => {
    expect(
      googleMapsSearchUrl({ ...base, googlePlaceId: 'ChIJod7tSseifDUR9hXHLFNGMIs', address: '서울 종로구' }),
    ).toBe(
      'https://www.google.com/maps/search/?api=1&query=%EA%B2%BD%EB%B3%B5%EA%B6%81&query_place_id=ChIJod7tSseifDUR9hXHLFNGMIs',
    );
  });

  it('place_id 가 없으면 이름+주소 검색 — 좌표보다 장소 카드에 닿을 확률이 높다', () => {
    expect(googleMapsSearchUrl({ ...base, address: '서울 종로구 사직로 161' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent('경복궁 서울 종로구 사직로 161'),
    );
    // 공백뿐인 place_id 는 없는 것과 같다 (구 인덱스 문서 폴백)
    expect(googleMapsSearchUrl({ ...base, googlePlaceId: ' ', address: '서울 종로구' })).toContain(
      '&query=' + encodeURIComponent('경복궁 서울 종로구'),
    );
  });

  it('place_id 도 주소도 없으면 좌표 검색 — 기존 동작 그대로', () => {
    expect(googleMapsSearchUrl(base)).toBe(
      'https://www.google.com/maps/search/?api=1&query=37.5788,126.977',
    );
    expect(googleMapsSearchUrl({ ...base, address: '  ' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=37.5788,126.977',
    );
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

describe('nearestRegion', () => {
  // 실좌표 — 시도 중심점 (admin_regions 가 관광지 좌표 평균으로 채우는 값과 같은 성격)
  const SIDOS = [
    { code: '11', latitude: 37.5665, longitude: 126.978 },   // 서울
    { code: '26', latitude: 35.1796, longitude: 129.0756 },  // 부산
    { code: '50', latitude: 33.4996, longitude: 126.5312 },  // 제주
    { code: '42', latitude: null, longitude: null },          // 관광지가 없어 좌표를 못 채운 시도
  ];

  it('가장 가까운 시도를 고른다', () => {
    expect(nearestRegion(SIDOS, 37.57, 126.98)?.code).toBe('11');   // 광화문
    expect(nearestRegion(SIDOS, 35.16, 129.16)?.code).toBe('26');   // 해운대
    expect(nearestRegion(SIDOS, 33.25, 126.56)?.code).toBe('50');   // 서귀포
  });

  it('좌표 없는 지역은 후보에서 뺀다 — 지어낸 좌표로 판정하지 않는다', () => {
    expect(nearestRegion(SIDOS, 37.8, 128.0)?.code).not.toBe('42');
  });

  it('후보가 전부 좌표 없으면 null — 호출자가 기본값으로 떨어진다', () => {
    expect(nearestRegion([{ code: '42', latitude: null, longitude: null }], 37.5, 127)).toBeNull();
  });

  it('빈 목록이면 null', () => {
    expect(nearestRegion([], 37.5, 127)).toBeNull();
  });
});
