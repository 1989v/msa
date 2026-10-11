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
  fetchRegionVisitorRanking: vi.fn(() => Promise.resolve({ month: null, items: [] })),
}));
vi.mock('../../../analytics/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../analytics/tracker')>()),
  track: vi.fn(),
}));

import {
  fetchAdministrativeRegions,
  fetchRegionVisitorRanking,
  fetchRegionVisitors,
  searchAttractions,
} from '../../../api/placeApi';
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
          <Route path="/en/regions/:code" element={<RegionPage />} />
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

  it('<main> 은 하나이고 지역 본문을 품으며 바닥글은 밖이다', async () => {
    renderAt('/regions/11');
    await screen.findByText('명소 201');

    const mains = document.querySelectorAll('main');
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveClass('place-body');
    expect(mains[0].querySelector('h1')).not.toBeNull();
    expect(mains[0].querySelector('footer')).toBeNull();
  });

  it('대표 관광지·이번 달 행사 카드가 https 로 그린다', async () => {
    renderAt('/regions/11');
    await screen.findByText('명소 201');
    await screen.findByRole('region', { name: '이번 달 행사' });

    expect(document.querySelectorAll('img[src^="https://tong."]')).toHaveLength(2);
    expect(document.querySelectorAll('img[src^="http://tong."], [data-src^="http://tong."]')).toHaveLength(0);
  });
});

describe('RegionPage 타지 방문자가 많은 시군구', () => {
  const sejong: AdministrativeRegion = { code: '36', parentCode: null, level: 'SIDO', name: '세종특별자치시', nameEn: 'Sejong', latitude: 36.48, longitude: 127.28, attractionCount: 50 };
  // 11개를 준다 — 화면은 서버가 준 상위 10을 그대로 그리고, 수치는 소수를 버린다
  const items = Array.from({ length: 10 }, (_, i) => ({
    code: `11${110 + i * 10}`, name: `구${i}`, nameEn: `Gu${i}`,
    outsiders: 1000 - i, foreigners: 0, total: 1000 - i + 0.9,
  }));
  items[0] = { code: '11680', name: '강남구', nameEn: 'Gangnam-gu', outsiders: 18558922, foreigners: 1042586, total: 19601508.7 };
  const ranking = { month: '2026-08', items };

  beforeEach(() => {
    vi.mocked(fetchAdministrativeRegions).mockImplementation(({ level }) =>
      Promise.resolve(level === 'SIDO' ? [seoul, sejong] : [jongno]),
    );
    vi.mocked(fetchRegionVisitors).mockResolvedValue({ code: '11', level: 'SIDO', latestDate: null, months: [] });
    respond([]);
  });
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('시도 — 시군구 페이지로 가는 순위, 「약 N명」(소수 버림), 원천·대상·기간 근거 줄과 기준 정의를 단다', async () => {
    vi.mocked(fetchRegionVisitorRanking).mockResolvedValueOnce(ranking);
    renderAt('/regions/11');
    const section = await screen.findByRole('region', { name: '타지 방문자가 많은 시군구' });

    expect(fetchRegionVisitorRanking).toHaveBeenCalledWith('11');
    const rows = within(section).getAllByRole('listitem');
    expect(rows).toHaveLength(10);
    const first = within(rows[0]).getByRole('link');
    expect(first).toHaveTextContent('강남구');
    expect(first.getAttribute('href')).toBe('/regions/11680');
    expect(rows[0]).toHaveTextContent('약 19,601,508명');
    expect(rows[1]).toHaveTextContent('약 999명');
    expect(
      within(section).getByText('한국관광공사 빅데이터(이동통신 추정) · 서울특별시 시군구 · 2026년 8월 · 외지인+외국인'),
    ).toBeInTheDocument();
    expect(within(section).getByText('기준 보기')).toBeInTheDocument();
    expect(within(section).getByText(/일자별 순방문자 합/)).toBeInTheDocument();
    expect(within(section).getByText(/같은 사람이 사흘 머물면 3명/)).toBeInTheDocument();
    // 원천 정의상 통근·통학은 빠져 있다 — 「통근 포함」을 붙이지 않는다
    expect(section.textContent).not.toContain('통근 포함');
  });

  it('영문 — 영문 지역 링크와 「about N」, 같은 세 칸 근거 줄', async () => {
    vi.mocked(fetchRegionVisitorRanking).mockResolvedValueOnce(ranking);
    renderAt('/en/regions/11');
    const section = await screen.findByRole('region', { name: 'Districts with the most visitors from elsewhere' });

    const first = within(section).getAllByRole('listitem')[0];
    expect(within(first).getByRole('link').getAttribute('href')).toBe('/en/regions/11680');
    expect(first).toHaveTextContent('Gangnam-gu');
    expect(first).toHaveTextContent('about 19,601,508');
    expect(
      within(section).getByText(
        'Korea Tourism Organization big data (mobile carrier estimate) · Districts of Seoul · Aug 2026 · from other regions + foreigners',
      ),
    ).toBeInTheDocument();
  });

  it('시군구 페이지는 순위를 부르지도 그리지도 않는다', async () => {
    vi.mocked(fetchRegionVisitorRanking).mockResolvedValue(ranking);
    renderAt('/regions/11110');
    await screen.findByRole('heading', { level: 1 });
    expect(fetchRegionVisitorRanking).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: '타지 방문자가 많은 시군구' })).toBeNull();
  });

  it('세종 — 서버가 빈 결과(시군구 3개 미만)를 주면 절을 숨긴다', async () => {
    vi.mocked(fetchRegionVisitorRanking).mockResolvedValueOnce({ month: null, items: [] });
    renderAt('/regions/36');
    await screen.findByRole('heading', { level: 1 });
    await vi.waitFor(() => expect(fetchRegionVisitorRanking).toHaveBeenCalledWith('36'));
    expect(screen.queryByRole('region', { name: '타지 방문자가 많은 시군구' })).toBeNull();
  });
});

describe('RegionPage 이 사이트 근거 절 — 많이 찜한 곳 · 이 사이트에서 많이 누른 곳', () => {
  // 서버가 이미 하한 이상만 담아 준다 — 화면은 건수(3곳 이상)로만 절을 정한다
  let saved: Attraction[] = [];
  let clicked: Attraction[] = [];
  const many = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => card(`${prefix}${i}`));

  beforeEach(() => {
    vi.mocked(fetchAdministrativeRegions).mockImplementation(({ level }) =>
      Promise.resolve(level === 'SIDO' ? [seoul] : [jongno]),
    );
    vi.mocked(fetchRegionVisitors).mockResolvedValue({ code: '11110', level: 'SIGUNGU', latestDate: null, months: [] });
    vi.mocked(searchAttractions).mockImplementation((q) => {
      const attractions = q.sort === 'saved' ? saved : q.sort === 'clicked' ? clicked : q.category === 'festival' ? [] : [card('201')];
      return Promise.resolve({ searchId: 's', attractions, totalElements: attractions.length, totalPages: 1, currentPage: 0 });
    });
  });
  afterEach(() => {
    saved = [];
    clicked = [];
    vi.clearAllMocks();
    cleanup();
  });

  it('시군구 — 두 절이 각자 sort=saved · sort=clicked 로 같은 시군구·관광 분류 상위 6을 부른다', async () => {
    saved = many('7', 3);
    clicked = many('8', 3);
    renderAt('/regions/11110');
    await screen.findByRole('region', { name: '많이 찜한 곳' });

    const sorted = searchCalls().filter((q) => q.sort === 'saved' || q.sort === 'clicked');
    expect(sorted.map((q) => q.sort).sort()).toEqual(['clicked', 'saved']);
    for (const q of sorted) {
      expect(q).toEqual(expect.objectContaining({
        lang: 'ko', sidoCode: '11', sigunguCode: '110', category: 'nature,history,culture,leisure', size: 6,
      }));
    }
  });

  it('찜 3곳 — 절 「많이 찜한 곳」, 관광지 링크와 원천·대상·기간 근거 줄', async () => {
    saved = many('7', 3);
    renderAt('/regions/11110');
    const section = await screen.findByRole('region', { name: '많이 찜한 곳' });

    expect(within(section).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual([
      '/attractions/70', '/attractions/71', '/attractions/72',
    ]);
    expect(within(section).getByText('이 사이트 회원 찜 · 종로구 관광지 · 누적 · 3명 이상만')).toBeInTheDocument();
  });

  it('클릭 3곳 — 절 「이 사이트에서 많이 누른 곳」, 근거 줄과 기준 보기(식별값 조작 한계)', async () => {
    clicked = many('8', 3);
    renderAt('/regions/11110');
    const section = await screen.findByRole('region', { name: '이 사이트에서 많이 누른 곳' });

    expect(within(section).getAllByRole('link')).toHaveLength(3);
    expect(
      within(section).getByText('이 사이트 이용자 클릭(같은 사람은 한 번) · 종로구 관광지 · 최근 14일 · 5명 이상만'),
    ).toBeInTheDocument();
    expect(within(section).getByText('기준 보기')).toBeInTheDocument();
    expect(within(section).getByText(/조작을 막지 못합니다/)).toBeInTheDocument();
    expect(section.textContent).not.toContain('방문자');
  });

  it('응답이 2건이면 절을 그리지 않는다', async () => {
    saved = many('7', 2);
    clicked = many('8', 2);
    renderAt('/regions/11110');
    await screen.findByText('명소 201');
    await vi.waitFor(() => expect(searchCalls().filter((q) => q.sort === 'saved' || q.sort === 'clicked')).toHaveLength(2));
    expect(screen.queryByRole('region', { name: '많이 찜한 곳' })).toBeNull();
    expect(screen.queryByRole('region', { name: '이 사이트에서 많이 누른 곳' })).toBeNull();
  });

  it('영문 — 절 제목과 같은 세 칸 근거 줄', async () => {
    saved = many('7', 3);
    clicked = many('8', 3);
    renderAt('/en/regions/11110');
    const savedSection = await screen.findByRole('region', { name: 'Most saved' });
    const clickedSection = await screen.findByRole('region', { name: 'Most clicked on this site' });

    expect(within(savedSection).getAllByRole('link')[0].getAttribute('href')).toBe('/en/attractions/70');
    expect(
      within(savedSection).getByText('Saves by members of this site · Attractions in Jongno-gu · All time · 3 or more people only'),
    ).toBeInTheDocument();
    expect(
      within(clickedSection).getByText(
        'Clicks by people on this site (each person once) · Attractions in Jongno-gu · Last 14 days · 5 or more people only',
      ),
    ).toBeInTheDocument();
    expect(clickedSection.textContent?.toLowerCase()).not.toContain('visitor');
  });

  it('시도 페이지는 두 절을 부르지도 그리지도 않는다', async () => {
    saved = many('7', 3);
    clicked = many('8', 3);
    renderAt('/regions/11');
    await screen.findByText('명소 201');
    expect(searchCalls().some((q) => q.sort === 'saved' || q.sort === 'clicked')).toBe(false);
    expect(screen.queryByRole('region', { name: '많이 찜한 곳' })).toBeNull();
  });
});
