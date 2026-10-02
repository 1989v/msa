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
