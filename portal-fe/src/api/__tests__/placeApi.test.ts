import { afterEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('axios', () => ({ default: { create: () => ({ get }) } }));

import { searchAttractions } from '../placeApi';

const sentParams = () => new URL(String(get.mock.calls[0][0]), 'http://x').searchParams;

describe('searchAttractions — 근처 행사·이번 달 행사 조건이 그대로 실린다', () => {
  afterEach(() => get.mockReset());

  it('근처 행사: 좌표·반경 20km · festival · NOT_ENDED · 시작일 순', async () => {
    get.mockResolvedValue({ data: { data: { attractions: [] } } });
    await searchAttractions({ lang: 'ko', lat: 37.5, lng: 127, radiusKm: 20, category: 'festival', eventStatus: 'NOT_ENDED', sort: 'eventStart', size: 12 });

    const p = sentParams();
    expect(Object.fromEntries(p)).toMatchObject({
      lat: '37.5', lng: '127', radiusKm: '20', category: 'festival', eventStatus: 'NOT_ENDED', sort: 'eventStart', size: '12',
    });
  });

  it('이번 달 행사: 시도·시군구 · THIS_MONTH · 8건', async () => {
    get.mockResolvedValue({ data: { data: { attractions: [] } } });
    await searchAttractions({ lang: 'ko', sidoCode: '11', sigunguCode: '110', category: 'festival', eventStatus: 'THIS_MONTH', sort: 'eventStart', size: 8 });

    expect(Object.fromEntries(sentParams())).toMatchObject({
      sidoCode: '11', sigunguCode: '110', category: 'festival', eventStatus: 'THIS_MONTH', sort: 'eventStart', size: '8',
    });
  });
});

describe('searchAttractions — 원래 검색어 검색(exact)', () => {
  afterEach(() => get.mockReset());

  it('exact 가 참이면 exact=true 를 싣는다', async () => {
    get.mockResolvedValue({ data: { data: { attractions: [] } } });
    await searchAttractions({ lang: 'ko', keyword: '경복궁ㅇ', category: 'nature', exact: true });
    expect(sentParams().get('exact')).toBe('true');
    expect(sentParams().get('keyword')).toBe('경복궁ㅇ');
  });

  it('exact 가 없거나 거짓이면 싣지 않는다', async () => {
    get.mockResolvedValue({ data: { data: { attractions: [] } } });
    await searchAttractions({ lang: 'ko', keyword: '경복궁', category: 'nature', exact: false });
    expect(sentParams().has('exact')).toBe(false);
  });
});

describe('searchAttractions — 조건어 해석 해제(keepConditionWords · skipCondition)', () => {
  afterEach(() => get.mockReset());

  it('keepConditionWords 가 참이면 keepConditionWords=true, skipCondition 은 param 마다 한 번씩 반복해 싣는다', async () => {
    get.mockResolvedValue({ data: { data: { attractions: [] } } });
    await searchAttractions({
      lang: 'ko', keyword: '주차 되는 해수욕장', category: 'nature', keepConditionWords: true, skipCondition: ['parking', 'pet'],
    });
    expect(sentParams().get('keepConditionWords')).toBe('true');
    expect(sentParams().getAll('skipCondition')).toEqual(['parking', 'pet']);
  });

  it('없거나 비면 둘 다 싣지 않는다', async () => {
    get.mockResolvedValue({ data: { data: { attractions: [] } } });
    await searchAttractions({ lang: 'ko', keyword: '해수욕장', category: 'nature', keepConditionWords: false, skipCondition: [] });
    expect(sentParams().has('keepConditionWords')).toBe(false);
    expect(sentParams().has('skipCondition')).toBe(false);
  });
});

describe('SIGHT_CATEGORIES — 정의는 copy.mjs 한 곳', () => {
  it('placeApi 가 내보내는 것은 copy.mjs 의 같은 배열이다(사본 아님)', async () => {
    const api = await import('../placeApi');
    const copy = await import('../../seo/copy.mjs');
    expect(api.SIGHT_CATEGORIES).toBe(copy.SIGHT_CATEGORIES);
  });
});
