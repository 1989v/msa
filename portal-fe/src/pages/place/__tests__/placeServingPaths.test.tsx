import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * 관광지 화면이 어디서 데이터를 읽는지 — 화면이 실제로 내보낸 요청 주소로 판정한다(소스 문자열이 아니라).
 *
 * 관광지 데이터는 검색 색인(`/api/search/*`)에서, 지역 계층은 place 의 레디스 캐시 경로에서 나간다
 * (ADR-0071 §서빙 경로). place 의 다른 GET 은 MySQL 을 직접 읽으므로 화면에서 불리면 안 된다.
 * 허용은 「캐시 경로라고 확인한 엔드포인트」를 하나씩 적는 목록이다 — `/api/places/` 앞부분 일치로 넓히면
 * 캐시 없는 GET 이 새로 생겨도 이 검사가 못 잡는다.
 * API 모듈은 진짜를 쓰고 그 아래 전송(axios 인스턴스 · fetch)만 갈아 끼워 주소를 모은다.
 */

const requests: Array<{ method: string; url: string }> = [];

const sido = { code: '11', parentCode: null, level: 'SIDO', name: '서울특별시', nameEn: 'Seoul', latitude: 37.56, longitude: 126.97, attractionCount: 4321 };
const sigungu = { code: '11110', parentCode: '11', level: 'SIGUNGU', name: '종로구', nameEn: 'Jongno-gu', latitude: 37.57, longitude: 126.98, attractionCount: 300 };
const card = (id: string) => ({
  id, contentId: id, lang: 'ko', title: `명소 ${id}`, category: 'history', areaCode: null, sidoCode: '11',
  address: null, latitude: 37.5, longitude: 127, imageUrl: null, tel: null, overview: null, distanceKm: 1, position: 0,
});
// 상세 응답이 들고 오는 링크 원문 — 화면은 이것만으로 영상·딥링크 절을 그려야 한다
const links = JSON.stringify({
  collected: [{
    source: 'YOUTUBE', externalId: 'v1', title: '경복궁 야경 영상', url: 'https://youtu.be/v1',
    thumbnailUrl: null, author: '서울여행', publishedAt: '2026-09-01T12:30:00', viewCount: 123456,
  }],
  deepLinks: [],
});

function respond(url: string): unknown {
  const visitors = url.match(/^\/api\/places\/administrative-regions\/(\d+)\/visitors$/);
  if (visitors) {
    return { code: visitors[1], level: 'SIDO', latestDate: '2026-09-02', months: [{ month: '2026-08', local: 5000000, outsider: 800000, foreigner: 12000 }] };
  }
  if (url.startsWith('/api/places/administrative-regions')) {
    return { regions: url.includes('level=SIGUNGU') ? [sigungu] : [sido] };
  }
  if (url.startsWith('/api/search/attractions/suggest')) return [];
  const detail = url.match(/^\/api\/search\/attractions\/(\w+)$/);
  if (detail) return { ...card(detail[1]), title: '경복궁', overview: '조선의 법궁이다.', links };
  if (url.startsWith('/api/search/attractions')) {
    return { searchId: 's', attractions: [card('100')], totalElements: 1, totalPages: 1, currentPage: 0 };
  }
  return null;
}

vi.mock('axios', () => {
  const instance = {
    get: vi.fn((url: string) => {
      requests.push({ method: 'GET', url });
      return Promise.resolve({ data: { success: true, data: respond(url) } });
    }),
    post: vi.fn((url: string) => {
      requests.push({ method: 'POST', url });
      return Promise.resolve({ data: { success: true, data: null } });
    }),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
    defaults: { headers: { common: {} } },
  };
  return { default: { create: () => instance, ...instance }, ...instance };
});
vi.mock('../../../components/favorite/FavoriteButton', () => ({ default: () => null }));
vi.mock('../../../components/ads/AdSlot', () => ({ default: () => null }));

import PlacePage from '../PlacePage';
import RegionPage from '../RegionPage';
import AttractionPage from '../AttractionPage';

/**
 * place 에서 화면이 불러도 되는 GET — 레디스 캐시를 거쳐 나가는 것만, 엔드포인트마다 한 줄.
 *  - 지역 계층: 적재가 캐시를 비우고 다음 요청이 채운다(`RegionCacheTest`).
 *  - 지역 방문 추이: 수집이 쓰면서 캐시를 덮는다(write-through). 캐시를 놓친 요청만 (수준, 지역) PK 범위를 읽는다
 *    (`RegionVisitorCacheTest`). 지역 단위 값이라 관광지 색인에 실을 자리가 없어 place 캐시 경로로 낸다(ADR-0104 덧붙임 4).
 */
const CACHED_PLACE_GETS = [
  /^\/api\/places\/administrative-regions\?/,
  /^\/api\/places\/administrative-regions\/\d{2}(\d{3})?\/visitors$/,
];
const isCachedPlaceGet = (url: string) => CACHED_PLACE_GETS.some((re) => re.test(url));

const placeGets = () => requests.filter((r) => r.method === 'GET' && r.url.startsWith('/api/places/')).map((r) => r.url);
const searchGets = () => requests.filter((r) => r.method === 'GET' && r.url.startsWith('/api/search/')).map((r) => r.url);

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/place" element={<PlacePage />} />
          <Route path="/regions/:code" element={<RegionPage />} />
          <Route path="/attractions/:id" element={<AttractionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('관광지 화면의 읽기 경로', () => {
  beforeEach(() => {
    requests.length = 0;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ method: (init?.method ?? 'GET').toUpperCase(), url: String(input) });
      return Promise.resolve(new Response('{}', { status: 202 }));
    }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('탐색 화면 — 목록·상세는 검색 색인, 지역 드롭다운은 캐시 경로만 부르고 링크는 상세 응답으로 그린다', async () => {
    renderAt('/place');
    fireEvent.click((await screen.findAllByText('명소 100'))[0]);
    await screen.findByText('경복궁 야경 영상');

    expect(screen.getByText(/조회수 12만회/)).toBeInTheDocument();
    expect(searchGets()).toContain('/api/search/attractions/100');
    expect(placeGets().length).toBeGreaterThan(0);
    placeGets().forEach((url) => expect(isCachedPlaceGet(url), url).toBe(true));
  });

  it('지역 허브 — 시도·시군구 모두 캐시 경로와 검색 색인만 부른다', async () => {
    renderAt('/regions/11');
    await screen.findAllByText('명소 100');
    cleanup();
    renderAt('/regions/11110');
    await screen.findAllByText('명소 100');

    expect(placeGets()).toEqual(expect.arrayContaining([
      expect.stringContaining('level=SIGUNGU'),
      '/api/places/administrative-regions/11/visitors',
      '/api/places/administrative-regions/11110/visitors',
    ]));
    placeGets().forEach((url) => expect(isCachedPlaceGet(url), url).toBe(true));
  });

  it('관광지 상세 — place 를 하나도 부르지 않고, 링크 절은 상세 응답의 원문으로 그린다', async () => {
    renderAt('/attractions/100');
    await screen.findByText('경복궁 야경 영상');
    await waitFor(() => expect(searchGets().length).toBeGreaterThan(1));

    expect(screen.getByText(/조회수 12만회/)).toBeInTheDocument();
    expect(searchGets()).toContain('/api/search/attractions/100');
    expect(placeGets()).toEqual([]);
  });
});
