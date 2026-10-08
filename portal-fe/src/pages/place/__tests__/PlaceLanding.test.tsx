import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdministrativeRegion, AttractionQuery, AttractionSearchResult } from '../../../api/placeApi';

/*
 * 속성 랜딩 SPA 화면 — 프리셋으로 연 허브. 기대 문장은 프리렌더 함수(placeLandingPages)와 landingMeta 의
 * 출력에서 가져온다 — 여기서 문장을 다시 조립하지 않는다.
 */

const flags = vi.hoisted(() => ({ indexable: false }));
vi.mock('../../../seo/copy.mjs', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  // 스위치는 상수라 켜 본 상태를 만들려면 모듈을 바꿔야 한다 — 읽는 순간의 값을 돌려준다
  return Object.defineProperty({ ...actual }, 'PLACE_LANDINGS_INDEXABLE', { get: () => flags.indexable, enumerable: true });
});
vi.mock('../../../content/place-landings.json', () => ({
  default: [
    { lang: 'ko', code: '11110', sidoCode: '11', attr: 'parking', count: 30, jaccardMax: 0, selectedAt: '2026-10-09' },
    { lang: 'ko', code: '11140', sidoCode: '11', attr: 'parking', count: 30, jaccardMax: 0, selectedAt: '2026-10-09', retired: true, retiredAt: '2026-10-09' },
    { lang: 'en', code: '11110', sidoCode: '11', attr: 'parking', count: 30, jaccardMax: 0, selectedAt: '2026-10-09' },
  ],
}));
vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  searchAttractions: vi.fn(),
  fetchAdministrativeRegions: vi.fn(),
  fetchAttraction: vi.fn(),
  suggestPlaces: vi.fn(),
}));
vi.mock('../../../api/wishlistApi', () => ({
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  fetchFavoriteKeys: vi.fn(),
  fetchFavorites: vi.fn(),
}));

import { fetchAdministrativeRegions, searchAttractions, suggestPlaces } from '../../../api/placeApi';
import { fetchFavoriteKeys } from '../../../api/wishlistApi';
import { resetIdentityForTest } from '../../../analytics/identity';
import { pendingForTest, resetTrackerForTest } from '../../../analytics/tracker';
import type { EventAction } from '../../../analytics/events';
import { placeLandingPages } from '../../../../scripts/prerender-seo.mjs';
import {
  PLACE_LANDING_ATTRS,
  PLACE_LANDING_MIN_RESULTS,
  PLACE_ORIGIN,
  SIGHT_CATEGORIES,
  landingMeta,
  landingPath,
} from '../../../seo/copy.mjs';
import { resetPlaceSessionForTest } from '../PlacePage';
import PlaceLandingRoute from '../PlaceLandingRoute';

const seoul: AdministrativeRegion = {
  code: '11', parentCode: null, level: 'SIDO', name: '서울특별시', nameEn: 'Seoul', latitude: 37.56, longitude: 126.97, attractionCount: 900,
};
const jongno: AdministrativeRegion = {
  code: '11110', parentCode: '11', level: 'SIGUNGU', name: '종로구', nameEn: 'Jongno-gu', latitude: 37.57, longitude: 126.98, attractionCount: 300,
};
const junggu: AdministrativeRegion = {
  code: '11140', parentCode: '11', level: 'SIGUNGU', name: '중구', nameEn: 'Jung-gu', latitude: 37.56, longitude: 126.99, attractionCount: 200,
};
const busan: AdministrativeRegion = {
  code: '26', parentCode: null, level: 'SIDO', name: '부산광역시', nameEn: 'Busan', latitude: 35.17, longitude: 129.07, attractionCount: 500,
};

/** 검색 응답 — 상위 n 건(최대 30), modifiedAt 은 i 가 클수록 최근(프리렌더 테스트와 같은 모양) */
function response(total: number, { facets = null as AttractionSearchResult['attributeFacets'], page = 0 } = {}): AttractionSearchResult {
  const n = Math.min(total, 30);
  return {
    searchId: 's',
    totalElements: total,
    totalPages: Math.max(1, Math.ceil(total / 30)),
    currentPage: page,
    attributeFacets: facets,
    attractions: Array.from({ length: n }, (_, i) => ({
      id: `a${i}`, contentId: `a${i}`, lang: 'ko', title: `관광지 a${i}`, category: 'history', areaCode: null,
      address: '서울특별시 종로구 사직로 161 (세종로)', latitude: 37.5, longitude: 127, imageUrl: null, tel: null,
      overview: null, distanceKm: null, position: i,
      modifiedAt: `2026-09-${String(10 + (i % 15)).padStart(2, '0')}T10:00:00`,
    })),
  };
}

function stubMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

/** 좌표 성공(부산 근처)·거부 — 프리셋 진입은 어느 쪽이든 자동 시도 선택을 하지 않는다 */
function stubGeolocation(mode: 'granted' | 'denied') {
  const getCurrentPosition = vi.fn((ok: PositionCallback, fail: PositionErrorCallback) => {
    if (mode === 'granted') ok({ coords: { latitude: 35.1, longitude: 129.0 } } as GeolocationPosition);
    else fail({ code: 1 } as GeolocationPositionError);
  });
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}

let pathnames: string[] = [];
function PathProbe() {
  pathnames.push(useLocation().pathname);
  return null;
}

function renderLanding(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <PathProbe />
        <Routes>
          <Route path="/regions/:code/:attr" element={<PlaceLandingRoute />} />
          <Route path="/en/regions/:code/:attr" element={<PlaceLandingRoute />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const byAction = (action: EventAction) => pendingForTest().filter((e) => e.action === action);
const triggers = () => byAction('SEARCH').map((e) => e.payload?.trigger);
const robots = () => document.head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null;
const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
/** 비동기 후속(좌표 콜백·자동 선택)이 있었다면 끝날 만큼 돌린다 */
const settle = () => new Promise((r) => setTimeout(r, 30));

/** 같은 픽스처의 프리렌더 출력 — h1 과 그 다음 문단 */
function prerendered(lang: 'ko' | 'en', total: number) {
  const regions = { ko: [seoul, jongno, junggu], en: [seoul, jongno] };
  const entry = { lang, code: '11110', sidoCode: '11', attr: 'parking', count: 30, jaccardMax: 0, selectedAt: '2026-10-09' };
  const results = new Map([[`${lang}/11110/parking`, response(total)]]);
  const { pages } = placeLandingPages('<html><head><!--seo:start--><!--seo:end--></head><body><div id="root"></div></body></html>', {
    landings: [entry],
    regions,
    results,
    indexable: false,
  });
  const page = pages[0];
  const sentence = /<\/h1><p>([^<]*)<\/p>/.exec(page.html)?.[1] ?? null;
  return { heading: page.heading, sentence };
}

describe('PlaceLandingRoute — 프리셋 랜딩', () => {
  let searchImpl: (q: AttractionQuery) => Promise<AttractionSearchResult>;

  beforeEach(() => {
    stubMedia();
    stubGeolocation('denied');
    sessionStorage.clear();
    localStorage.clear();
    document.head.innerHTML = '';
    resetTrackerForTest();
    resetIdentityForTest();
    resetPlaceSessionForTest();
    flags.indexable = false;
    pathnames = [];
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 202 })));
    vi.mocked(fetchAdministrativeRegions).mockImplementation(({ level, parent }) =>
      Promise.resolve(level === 'SIDO' ? [seoul, busan] : parent === '11' ? [jongno, junggu] : []),
    );
    vi.mocked(suggestPlaces).mockResolvedValue([]);
    vi.mocked(fetchFavoriteKeys).mockResolvedValue([]);
    searchImpl = (q) => Promise.resolve(response(35, { page: q.page ?? 0 }));
    vi.mocked(searchAttractions).mockImplementation((q) => searchImpl(q));
  });
  afterEach(() => {
    cleanup();
    resetTrackerForTest();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    Reflect.deleteProperty(navigator, 'geolocation');
  });

  it.each(['granted', 'denied'] as const)('좌표 %s — SEARCH trigger 열은 [landing] 하나, 자동 시도 선택이 없다', async (mode) => {
    const geo = stubGeolocation(mode);
    renderLanding('/regions/11110/parking');
    await waitFor(() => expect(triggers()).toEqual(['landing']));
    await screen.findByText(landingMeta('ko', seoul, jongno, 'parking').heading);
    await settle();

    expect(triggers()).toEqual(['landing']);
    expect(geo).not.toHaveBeenCalled();
    const [first] = byAction('SEARCH');
    expect(first.payload).toMatchObject({ sido: '11', sigungu: '110', attributes: ['parking'], landing: '11110/parking' });
    expect(first.screenRef).toBe('11110');
  });

  it('프리셋 질의 — sigunguCode 는 3자리, category 는 관광 분류, 속성 파라미터 하나', async () => {
    renderLanding('/regions/11110/parking');
    await waitFor(() => expect(searchAttractions).toHaveBeenCalled());
    const q = vi.mocked(searchAttractions).mock.calls[0][0];
    const def = PLACE_LANDING_ATTRS.find((a) => a.attr === 'parking')!;
    expect(q).toMatchObject({
      sidoCode: '11',
      sigunguCode: '110',
      category: SIGHT_CATEGORIES.join(','),
      [def.param.key]: def.param.value,
      page: 0,
      size: 30,
    });
    expect(q.lat).toBeUndefined();
  });

  it('조건을 바꿔도 주소·canonical 은 그대로, 모든 SEARCH 가 같은 시도·시군구·랜딩 표지를 싣는다', async () => {
    renderLanding('/regions/11110/parking');
    await waitFor(() => expect(triggers()).toEqual(['landing']));
    const url = `${PLACE_ORIGIN}${landingPath('ko', '11110', 'parking')}`;
    await waitFor(() => expect(canonical()).toBe(url));

    fireEvent.click(screen.getByRole('button', { name: /^입장 무료/ }));
    await waitFor(() => expect(triggers()).toEqual(['landing', 'attribute']));

    const searches = byAction('SEARCH');
    expect(searches.map((e) => e.payload?.landing)).toEqual(['11110/parking', '11110/parking']);
    expect(searches.map((e) => [e.payload?.sido, e.payload?.sigungu])).toEqual([['11', '110'], ['11', '110']]);
    searches.forEach((e) => expect(e.payload?.attributes).toContain('parking'));
    expect(canonical()).toBe(url);
    expect(new Set(pathnames)).toEqual(new Set(['/regions/11110/parking']));
  });

  it.each([
    ['/regions/11110/foo'],
    ['/en/regions/11110/pet'],
    ['/regions/99999/parking'],
    ['/regions/11170/parking'],
  ])('목록에 없는 조합 %s → NotFoundPage, 검색하지 않는다', async (path) => {
    renderLanding(path);
    expect(await screen.findByRole('heading', { name: /페이지를 찾을 수 없습니다|Page not found/ })).toBeTruthy();
    expect(searchAttractions).not.toHaveBeenCalled();
    expect(robots()).toBe('noindex, follow');
  });

  it.each(['ko', 'en'] as const)('%s heading·sentence 가 같은 픽스처의 프리렌더 출력과 같다', async (lang) => {
    renderLanding(lang === 'en' ? '/en/regions/11110/parking' : '/regions/11110/parking');
    const expected = prerendered(lang, 35);
    expect(expected.sentence).toBeTruthy();
    const heading = await screen.findByText(expected.heading);
    expect(heading.closest('h1')).not.toBeNull();
    expect(await screen.findByText(expected.sentence!)).toBeTruthy();
  });

  it('첫 결과의 facet 이 null 이어도 N 은 totalElements, 결과 전에는 noindex', async () => {
    flags.indexable = true;
    let release: (r: AttractionSearchResult) => void = () => {};
    searchImpl = () => new Promise((r) => (release = r));
    renderLanding('/regions/11110/parking');
    await screen.findByText(landingMeta('ko', seoul, jongno, 'parking').heading);
    await waitFor(() => expect(robots()).toBe('noindex, follow'));

    release(response(12, { facets: null }));
    const expected = prerendered('ko', 12);
    expect(await screen.findByText(expected.sentence!)).toBeTruthy();
    // 스위치 켜짐 · 비은퇴 · N(12) ≥ 하한 — 색인을 막을 이유가 없다
    await waitFor(() => expect(robots()).toBeNull());
  });

  it('스위치가 켜져도 첫 결과 N 이 하한 미만이면 noindex', async () => {
    flags.indexable = true;
    searchImpl = () => Promise.resolve(response(PLACE_LANDING_MIN_RESULTS - 1));
    renderLanding('/regions/11110/parking');
    await screen.findByText(prerendered('ko', PLACE_LANDING_MIN_RESULTS - 1).sentence!);
    expect(robots()).toBe('noindex, follow');
  });

  it('하한 이상으로 색인된 뒤 조건을 바꿔 건수가 줄어도 다시 계산하지 않는다', async () => {
    flags.indexable = true;
    searchImpl = (q) => Promise.resolve(q.admission ? response(2) : response(PLACE_LANDING_MIN_RESULTS));
    renderLanding('/regions/11110/parking');
    await waitFor(() => expect(triggers()).toEqual(['landing']));
    await waitFor(() => expect(robots()).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /^입장 무료/ }));
    await waitFor(() => expect(triggers()).toEqual(['landing', 'attribute']));
    await settle();
    expect(robots()).toBeNull();
    expect(screen.getByText(prerendered('ko', PLACE_LANDING_MIN_RESULTS).sentence!)).toBeTruthy();
  });

  it('은퇴 항목 → 화면은 그리고 noindex(스위치 켜짐·N 충분해도)', async () => {
    flags.indexable = true;
    renderLanding('/regions/11140/parking');
    expect(await screen.findByText(landingMeta('ko', seoul, junggu, 'parking').heading)).toBeTruthy();
    await waitFor(() => expect(triggers()).toEqual(['landing']));
    await settle();
    expect(robots()).toBe('noindex, follow');
  });

  it('스위치가 꺼져 있으면 N 이 충분해도 noindex', async () => {
    renderLanding('/regions/11110/parking');
    await screen.findByText(prerendered('ko', 35).sentence!);
    await settle();
    expect(robots()).toBe('noindex, follow');
  });

  it('남아 있던 로그인 복귀 상태보다 프리셋이 이긴다 — 첫 질의는 랜딩 조건, trigger landing', async () => {
    sessionStorage.setItem(
      'kgd.placeHubState.v1',
      JSON.stringify({
        keyword: '', exactFor: null, category: null, attributes: ['wellness'], areaCode: null, sidoCode: '26',
        sigunguCode: null, geo: null, listEventStatus: null, selectedId: null, page: 0, createdAt: Date.now(),
      }),
    );
    renderLanding('/regions/11110/parking');
    await waitFor(() => expect(triggers()).toEqual(['landing']));
    expect(vi.mocked(searchAttractions).mock.calls[0][0]).toMatchObject({ sidoCode: '11', sigunguCode: '110', parking: 'YES' });
    expect(vi.mocked(searchAttractions).mock.calls[0][0].wellness).toBeUndefined();
    expect(sessionStorage.getItem('kgd.placeHubState.v1')).toBeNull();
  });
});
