import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdministrativeRegion, Attraction, AttractionQuery } from '../../../api/placeApi';

vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  searchAttractions: vi.fn(),
  fetchAdministrativeRegions: vi.fn(),
}));
vi.mock('../../../analytics/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../analytics/tracker')>()),
  track: vi.fn(),
}));

import { fetchAdministrativeRegions, searchAttractions } from '../../../api/placeApi';
import { track } from '../../../analytics/tracker';
import { renderRegionDetail } from '../../../../scripts/prerender-seo.mjs';
import RegionPage from '../RegionPage';

const seoul: AdministrativeRegion = { code: '11', parentCode: null, level: 'SIDO', name: '서울특별시', nameEn: 'Seoul', latitude: 37.56, longitude: 126.97, attractionCount: 4321 };
const jongno: AdministrativeRegion = { code: '11110', parentCode: '11', level: 'SIGUNGU', name: '종로구', nameEn: 'Jongno-gu', latitude: 37.57, longitude: 126.98, attractionCount: 300 };

const card = (id: string, category = 'history', extra: Partial<Attraction> = {}): Attraction => ({
  id, contentId: id, lang: 'ko', title: `명소 ${id}`, category, areaCode: null,
  address: null, latitude: 37.5, longitude: 127, imageUrl: null, tel: null, overview: null,
  distanceKm: null, position: 0, ...extra,
});
const ev = (id: string, start: string, end: string) =>
  card(id, 'festival', { title: `행사 ${id}`, contentTypeId: '15', eventStart: start, eventEnd: end });

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/regions/:code" element={<RegionPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const searchCalls = () => vi.mocked(searchAttractions).mock.calls.map(([q]) => q as AttractionQuery);

function respond(events: Attraction[]) {
  vi.mocked(searchAttractions).mockImplementation((q) => {
    const attractions = q.category === 'festival' ? events : [card('201')];
    return Promise.resolve({ searchId: 's', attractions, totalElements: attractions.length, totalPages: 1, currentPage: 0 });
  });
}

describe('RegionPage 이번 달 행사', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'));
    vi.mocked(fetchAdministrativeRegions).mockImplementation(({ level }) =>
      Promise.resolve(level === 'SIDO' ? [seoul] : [jongno]),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
  });

  it('시도 — 그 시도의 이번 달 행사를 시작일 순 최대 8건, 기간과 함께 그린다', async () => {
    respond(['601', '602'].map((id) => ev(id, '2026-10-10', '2026-10-31')));
    renderAt('/regions/11');
    const section = await screen.findByRole('region', { name: '이번 달 행사' });

    expect(searchCalls().find((q) => q.category === 'festival')).toEqual(expect.objectContaining({
      lang: 'ko', sidoCode: '11', category: 'festival', eventStatus: 'THIS_MONTH', sort: 'eventStart', size: 8,
    }));
    const links = within(section).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/attractions/601', '/attractions/602']);
    expect(within(links[0]).getByText('2026-10-10 ~ 2026-10-31')).toBeInTheDocument();
  });

  it('시군구 — 시도·시군구 조건을 함께 보낸다', async () => {
    respond([ev('601', '2026-10-10', '2026-10-31')]);
    renderAt('/regions/11110');
    await screen.findByRole('region', { name: '이번 달 행사' });

    expect(searchCalls().find((q) => q.category === 'festival')).toEqual(expect.objectContaining({
      sidoCode: '11', sigunguCode: '110', eventStatus: 'THIS_MONTH',
    }));
  });

  it('0건이면 절을 그리지 않는다', async () => {
    respond([]);
    renderAt('/regions/11');
    await screen.findByText('명소 201');
    expect(screen.queryByRole('region', { name: '이번 달 행사' })).toBeNull();
  });

  it('노출 기록 섹션 식별자는 REGION_EVENTS_THIS_MONTH, 화면은 PLACE_REGION · 그 지역 코드다', async () => {
    respond([ev('601', '2026-10-10', '2026-10-31')]);
    renderAt('/regions/11');
    const section = await screen.findByRole('region', { name: '이번 달 행사' });
    fireEvent.click(within(section).getByRole('link'));

    const click = vi.mocked(track).mock.calls.find(([action]) => action === 'CLICK')!;
    expect(click[1]).toMatchObject({
      entityType: 'ATTRACTION', entityId: '601', screenType: 'PLACE_REGION', screenRef: '11',
      sectionId: 'REGION_EVENTS_THIS_MONTH', itemIndex: 0,
    });
  });

  it('지역 프리렌더 본문에는 이번 달 행사가 없다 — 빌드 사이에 낡는다', () => {
    const html = renderRegionDetail('<html><head><!--seo:start--><!--seo:end--></head><body><div id="root"></div></body></html>', 'ko', seoul, {
      top: [{ id: '42', title: '경복궁', hasOverview: true }],
    });
    expect(html).toContain('대표 관광지');
    expect(html).not.toContain('이번 달 행사');
  });
});
