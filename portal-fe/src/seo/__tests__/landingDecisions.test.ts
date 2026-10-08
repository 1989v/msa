import { describe, expect, it } from 'vitest';
import {
  PLACE_LANDINGS_INDEXABLE,
  PLACE_LANDING_ATTRS,
  PLACE_LANDING_MAX_JACCARD,
  PLACE_LANDING_MAX_PER_ATTR,
  PLACE_LANDING_MAX_TOTAL,
  PLACE_LANDING_MIN_RESULTS,
  SIGHT_CATEGORIES,
} from '../copy.mjs';

// 사용자 결정(하한·상한·슬러그 정의·색인 스위치)을 리터럴로 고정한다.
// 상수를 바꾸는 커밋은 이 단언도 함께 바꿔야 한다 — 다른 테스트는 상수에서 기대값을 계산한다.
describe('속성 랜딩 결정 수치', () => {
  it('색인 스위치는 꺼져 있다 — 켜는 것은 ADR-0062 개정 수용과 같은 커밋', () => {
    expect(PLACE_LANDINGS_INDEXABLE).toBe(false);
  });

  it('하한 10 · 속성당 5 · 합산 20 · Jaccard 0.5', () => {
    expect(PLACE_LANDING_MIN_RESULTS).toBe(10);
    expect(PLACE_LANDING_MAX_PER_ATTR).toBe(5);
    expect(PLACE_LANDING_MAX_TOTAL).toBe(20);
    expect(PLACE_LANDING_MAX_JACCARD).toBe(0.5);
  });

  it('슬러그 표 4행 — attr · facet 키 · 국문 이름', () => {
    expect(PLACE_LANDING_ATTRS.map((a) => [a.attr, a.facetKey, a.nameKo])).toEqual([
      ['parking', 'parking.YES', '주차 가능'],
      ['pet', 'pet.ALLOWED', '반려동물 동반'],
      ['barrier-free', 'barrierFree.WHEELCHAIR', '휠체어 대여'],
      ['free', 'admission.FREE', '입장 무료'],
    ]);
  });

  it('영문 랜딩은 parking · free 만', () => {
    expect(PLACE_LANDING_ATTRS.filter((a) => a.langs.includes('en')).map((a) => a.attr)).toEqual(['parking', 'free']);
  });

  it('관광 성격 분류', () => {
    expect(SIGHT_CATEGORIES).toEqual(['nature', 'history', 'culture', 'leisure']);
  });
});
