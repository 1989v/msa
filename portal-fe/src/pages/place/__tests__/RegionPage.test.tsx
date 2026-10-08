import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdministrativeRegion, Attraction, AttractionQuery } from '../../../api/placeApi';

vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  searchAttractions: vi.fn(),
  fetchAdministrativeRegions: vi.fn(),
  fetchRegionVisitors: vi.fn(),
}));
vi.mock('../../../analytics/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../analytics/tracker')>()),
  track: vi.fn(),
}));

import { fetchAdministrativeRegions, fetchRegionVisitors, searchAttractions } from '../../../api/placeApi';
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
    vi.mocked(fetchRegionVisitors).mockResolvedValue({ code: '11', level: 'SIDO', latestDate: null, months: [] });
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

describe('RegionPage 방문 추이', () => {
  const trend = {
    code: '11110', level: 'SIGUNGU' as const, latestDate: '2026-09-02',
    months: [
      { month: '2026-07', local: 4_000_000, outsider: 600_000, foreigner: 10_000 },
      { month: '2026-08', local: 5_000_000, outsider: 800_000, foreigner: 12_000 },
    ],
  };
  beforeEach(() => {
    vi.mocked(fetchAdministrativeRegions).mockImplementation(({ level }) =>
      Promise.resolve(level === 'SIDO' ? [seoul] : [jongno]),
    );
    respond([]);
  });
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('그 지역 코드로 부르고, 달마다 현지인·외지인·외국인을 그린 뒤 출처와 기준일을 단다', async () => {
    vi.mocked(fetchRegionVisitors).mockResolvedValue(trend);
    renderAt('/regions/11110');
    const section = await screen.findByRole('region', { name: '방문 추이' });

    expect(fetchRegionVisitors).toHaveBeenCalledWith('11110');
    const bars = within(section).getAllByRole('listitem');
    expect(bars.map((b) => b.getAttribute('aria-label'))).toEqual([
      '2026년 7월 — 현지인 4,000,000명 · 외지인 600,000명 · 외국인 10,000명',
      '2026년 8월 — 현지인 5,000,000명 · 외지인 800,000명 · 외국인 12,000명',
    ]);
    // 막대 높이는 가장 큰 달 합계 대비 — 8월이 100%
    expect((bars[1].querySelector('.place-visitor-stack') as HTMLElement).style.height).toBe('100%');
    expect(within(section).getByText(/출처: 한국관광공사 빅데이터/)).toBeInTheDocument();
    expect(within(section).getByText(/2026-09-02/)).toBeInTheDocument();
  });

  it('다 받은 달이 없으면 절을 그리지 않는다', async () => {
    vi.mocked(fetchRegionVisitors).mockResolvedValue({ ...trend, months: [] });
    renderAt('/regions/11110');
    await screen.findByText('명소 201');
    expect(screen.queryByRole('region', { name: '방문 추이' })).toBeNull();
  });

  it('조회가 실패해도 나머지 허브는 그대로다', async () => {
    vi.mocked(fetchRegionVisitors).mockRejectedValue(new Error('down'));
    renderAt('/regions/11110');
    await screen.findByText('명소 201');
    expect(screen.queryByRole('region', { name: '방문 추이' })).toBeNull();
  });

  it('지역 프리렌더 본문에는 방문 추이가 없다 — 조회 시점에 그린다', () => {
    const html = renderRegionDetail('<html><head><!--seo:start--><!--seo:end--></head><body><div id="root"></div></body></html>', 'ko', jongno, {
      top: [{ id: '42', title: '경복궁', hasOverview: true }],
    });
    expect(html).not.toContain('방문 추이');
  });
});

describe('RegionPage 사진 주소 https', () => {
  const TONG = 'http://tong.visitkorea.or.kr/cms/resource/';
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'));
    vi.mocked(fetchAdministrativeRegions).mockImplementation(({ level }) =>
      Promise.resolve(level === 'SIDO' ? [seoul] : [jongno]),
    );
    vi.mocked(fetchRegionVisitors).mockResolvedValue({ code: '11', level: 'SIDO', latestDate: null, months: [] });
    // 대표 관광지·이번 달 행사 둘 다 http tong 원천
    vi.mocked(searchAttractions).mockImplementation((q) => {
      const attractions = q.category === 'festival'
        ? [{ ...ev('601', '2026-10-10', '2026-10-31'), imageUrl: `${TONG}601.jpg` }]
        : [card('201', 'history', { imageUrl: `${TONG}201.jpg` })];
      return Promise.resolve({ searchId: 's', attractions, totalElements: 1, totalPages: 1, currentPage: 0 });
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
  });

  it('대표 관광지·이번 달 행사 카드가 https 로 그린다', async () => {
    renderAt('/regions/11');
    await screen.findByText('명소 201');
    await screen.findByRole('region', { name: '이번 달 행사' });

    expect(document.querySelectorAll('img[src^="https://tong."]')).toHaveLength(2);
    expect(document.querySelectorAll('img[src^="http://tong."], [data-src^="http://tong."]')).toHaveLength(0);
  });
});
