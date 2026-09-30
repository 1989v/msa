import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attraction, AttractionQuery } from '../../../api/placeApi';

vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  searchAttractions: vi.fn(),
  fetchAttraction: vi.fn(),
}));
vi.mock('../../../components/favorite/FavoriteButton', () => ({ default: () => null }));
vi.mock('../../../components/ads/AdSlot', () => ({ default: () => null }));

import { fetchAttraction, searchAttractions } from '../../../api/placeApi';
import AttractionPage from '../AttractionPage';

const card = (id: string, category = 'history'): Attraction => ({
  id, contentId: id, lang: 'ko', title: `명소 ${id}`, category, areaCode: null,
  address: null, latitude: 37.5, longitude: 127, imageUrl: null, tel: null, overview: null,
  distanceKm: 1, position: 0,
});

const enriched: Attraction = {
  ...card('100'),
  title: '경복궁',
  overview: '조선의 법궁이다.',
  useTime: '09:00~18:00',
  sidoCode: '11',
  contentTypeId: '12',
  closureState: 'WEEKLY',
  closedWeekdays: ['TUE'],
  attrParking: 'YES',
  attrCreditCard: 'UNKNOWN',
  attrStrollerRental: 'NO',
  petPolicy: 'UNKNOWN',
  attrAdmission: 'PAID',
  region: {
    ldongSignguCd: '110',
    sigunguName: '종로구',
    typeCount: 40,
    categoryCount: 7,
    categoryName: '고궁',
    sameCategoryNearby: [
      { id: '201', title: '창덕궁', distanceMeters: 1500 },
      { id: '202', title: '경희궁', distanceMeters: 800 },
    ],
  },
};

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

const h2Texts = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
const searchCalls = () => vi.mocked(searchAttractions).mock.calls.map(([q]) => q as AttractionQuery);

describe('AttractionPage 새 섹션', () => {
  beforeEach(() => {
    vi.mocked(searchAttractions).mockImplementation((q) =>
      Promise.resolve({
        searchId: 's',
        // 주변 명소 응답에 자기 자신과 같은 분류 가까운 곳(201)이 섞여 온다
        attractions: q.category?.includes('history')
          ? [card('100'), card('201'), card('301'), card('302')]
          : [card('401', 'food')],
        totalElements: 4, totalPages: 1, currentPage: 0,
      }),
    );
  });
  afterEach(() => vi.clearAllMocks());

  it('개요·이용 안내 → 방문 정보 요약 → 지역 안 위치 → 같은 분류 가까운 곳 → 주변 명소 → 편의시설 순서다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    await screen.findByText('명소 301');
    await screen.findByText('명소 401');

    const order = ['이용 안내', '방문 정보 요약', '지역 안 위치', '같은 분류 가까운 곳', '주변 명소', '주변 편의시설'];
    const seen = h2Texts().filter((t) => order.includes(t ?? ''));
    expect(seen).toEqual(order);
    const overview = screen.getByText('조선의 법궁이다.');
    const badges = screen.getByRole('region', { name: '방문 정보 요약' });
    expect(overview.compareDocumentPosition(badges) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('배지는 해석된 값만, 서버 렌더와 같은 문구로 그린다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    const badges = await screen.findByRole('region', { name: '방문 정보 요약' });

    expect(within(badges).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '매주 화요일 휴무', '주차 가능', '유모차 대여 없음', '입장 유료',
    ]);
  });

  it('지역 문구와 시군구 허브 링크, 같은 분류 가까운 곳을 그린다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    const region = await screen.findByRole('region', { name: '지역 안 위치' });

    expect(within(region).getByText('종로구 관광지 40곳 중 고궁 7곳')).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: '종로구 둘러보기' })).toHaveAttribute('href', '/regions/11110');
    const same = screen.getByRole('region', { name: '같은 분류 가까운 곳' });
    const links = within(same).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['창덕궁1.5km', '경희궁800m']);
    expect(links[0]).toHaveAttribute('href', '/attractions/201');
  });

  it('같은 분류 가까운 곳에 나온 곳은 주변 명소에서 뺀다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    const nearby = await screen.findByRole('region', { name: '주변 명소' });
    await within(nearby).findByText('명소 301');

    expect(within(nearby).queryByText('명소 201')).toBeNull();
    expect(within(nearby).queryByText('명소 100')).toBeNull();
    expect(within(nearby).getByText('명소 302')).toBeInTheDocument();
  });

  it('상세의 주변·편의시설 검색은 건수를 요청하지 않는다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    await screen.findByText('명소 401');

    expect(searchCalls()).toHaveLength(2);
    for (const q of searchCalls()) expect(q.facets).toBeFalsy();
  });

  it('영문 화면은 영문 제목·문구를 쓴다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({
      ...enriched,
      lang: 'en',
      contentTypeId: '76',
      region: { ...enriched.region!, sigunguName: 'Jongno-gu', categoryName: 'Palaces' },
    });
    renderAt('/en/attractions/100');
    const region = await screen.findByRole('region', { name: 'In the area' });

    expect(within(region).getByText('Palaces 7 of 40 attractions in Jongno-gu')).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Explore Jongno-gu' })).toBeInTheDocument();
    const badges = screen.getByRole('region', { name: 'At a glance' });
    expect(within(badges).getByText('Closed on Tuesdays')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Similar places nearby' })).toBeInTheDocument();
  });

  it('유형 코드가 없으면 지역 문구를 짐작하지 않는다 — 허브 링크만 둔다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, contentTypeId: undefined });
    renderAt('/attractions/100');
    const region = await screen.findByRole('region', { name: '지역 안 위치' });

    expect(within(region).queryByText(/곳 중/)).toBeNull();
    expect(within(region).getByRole('link', { name: '종로구 둘러보기' })).toBeInTheDocument();
  });

  it('속성·지역이 없는 옛 문서는 새 섹션을 하나도 그리지 않고 기존 섹션은 그대로다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...card('100'), title: '옛 문서', overview: '개요' });
    renderAt('/attractions/100');
    await screen.findByText('명소 201');

    expect(screen.queryByRole('region', { name: '방문 정보 요약' })).toBeNull();
    expect(screen.queryByRole('region', { name: '지역 안 위치' })).toBeNull();
    expect(screen.queryByRole('region', { name: '같은 분류 가까운 곳' })).toBeNull();
    expect(h2Texts()).toEqual(expect.arrayContaining(['주변 명소', '주변 편의시설']));
  });
});
