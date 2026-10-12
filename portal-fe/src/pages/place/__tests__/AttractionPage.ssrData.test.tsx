import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttractionDetail } from '../../../api/placeApi';

vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  searchAttractions: vi.fn(),
  fetchAttractionNearby: vi.fn(),
  fetchAttraction: vi.fn(),
  fetchWeather: vi.fn(),
  fetchAirQuality: vi.fn(),
}));
vi.mock('../../../components/favorite/FavoriteButton', () => ({ default: () => null }));
vi.mock('../../../components/ads/AdSlot', () => ({ default: () => null }));
vi.mock('../../../api/wishlistApi', () => ({
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  fetchFavoriteKeys: vi.fn(),
  fetchFavorites: vi.fn(),
}));
vi.mock('../../../analytics/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../analytics/tracker')>()),
  track: vi.fn(),
}));

import { fetchAirQuality, fetchAttraction, fetchAttractionNearby, fetchWeather } from '../../../api/placeApi';
import AttractionPage from '../AttractionPage';
import { SSR_ATTRACTION_DATA_ID } from '../ssrAttractionData';

window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as unknown as typeof window.matchMedia;

const detail = (over: Partial<AttractionDetail> = {}): AttractionDetail => ({
  id: '100', contentId: '100', lang: 'ko', title: '경복궁', category: 'history', areaCode: null,
  address: '서울특별시 종로구', latitude: 37.5, longitude: 127, imageUrl: null, tel: null,
  overview: '조선의 법궁이다.', distanceKm: null, position: 0, shortUrl: null,
  ...over,
});

/** 서버 렌더가 내는 것처럼 #root 밖에 데이터 노드를 둔다 */
function putSsrData(text: string) {
  const node = document.createElement('script');
  node.type = 'application/json';
  node.id = SSR_ATTRACTION_DATA_ID;
  node.textContent = text;
  document.body.prepend(node);
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/attractions/:id" element={<AttractionPage />} />
          <Route path="/en/attractions/:id" element={<AttractionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(fetchAttraction).mockReset();
  vi.mocked(fetchAttractionNearby).mockResolvedValue({ sights: [], stays: [], events: [], amenities: [] });
  vi.mocked(fetchWeather).mockResolvedValue({ sigunguCode: '11110', shortBaseAt: null, midTmFc: null, days: [] });
  vi.mocked(fetchAirQuality).mockResolvedValue({ sigunguCode: '11110', stations: [] });
});

afterEach(() => {
  cleanup();
  document.getElementById(SSR_ATTRACTION_DATA_ID)?.remove();
});

describe('AttractionPage — 서버 렌더가 실어 보낸 상세 데이터', () => {
  it('지금 경로와 같은 문서면 그것으로 그리고 상세 API 를 부르지 않는다', async () => {
    putSsrData(JSON.stringify(detail()));

    renderAt('/attractions/100');

    expect(await screen.findByRole('heading', { level: 1, name: '경복궁' })).toBeTruthy();
    expect(fetchAttraction).not.toHaveBeenCalled();
  });

  it('읽은 뒤 노드를 지운다 — SPA 안의 다음 상세가 앞 문서의 데이터를 다시 읽지 않는다', async () => {
    putSsrData(JSON.stringify(detail()));

    renderAt('/attractions/100');

    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    expect(document.getElementById(SSR_ATTRACTION_DATA_ID)).toBeNull();
  });

  it('id 가 다르면 쓰지 않고 API 를 부른다', async () => {
    putSsrData(JSON.stringify(detail({ id: '999', title: '다른 곳' })));
    vi.mocked(fetchAttraction).mockResolvedValue(detail());

    renderAt('/attractions/100');

    expect(await screen.findByRole('heading', { level: 1, name: '경복궁' })).toBeTruthy();
    expect(fetchAttraction).toHaveBeenCalledWith('100');
    expect(screen.queryByText('다른 곳')).toBeNull();
  });

  it('언어가 경로와 다르면 쓰지 않고 API 를 부른다', async () => {
    putSsrData(JSON.stringify(detail({ lang: 'ko' })));
    vi.mocked(fetchAttraction).mockResolvedValue(detail({ lang: 'en', title: 'Gyeongbokgung Palace' }));

    renderAt('/en/attractions/100');

    expect(await screen.findByRole('heading', { level: 1, name: 'Gyeongbokgung Palace' })).toBeTruthy();
    expect(fetchAttraction).toHaveBeenCalledWith('100');
  });

  it('JSON 이 깨져 있으면 API 를 부른다', async () => {
    putSsrData('{"id":"100",');
    vi.mocked(fetchAttraction).mockResolvedValue(detail());

    renderAt('/attractions/100');

    expect(await screen.findByRole('heading', { level: 1, name: '경복궁' })).toBeTruthy();
    expect(fetchAttraction).toHaveBeenCalledWith('100');
  });

  it('데이터가 없고 API 가 404 면 지금처럼 「찾을 수 없음」이다', async () => {
    vi.mocked(fetchAttraction).mockRejectedValue({ response: { status: 404 } });

    renderAt('/attractions/100');

    expect(await screen.findByText('관광지를 찾을 수 없습니다.')).toBeTruthy();
    expect(fetchAttraction).toHaveBeenCalledWith('100');
  });
});
