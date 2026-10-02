import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attraction, AttractionQuery } from '../../../api/placeApi';

vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  searchAttractions: vi.fn(),
  fetchAttraction: vi.fn(),
  fetchWeather: vi.fn(),
  fetchAirQuality: vi.fn(),
}));
vi.mock('../../../components/favorite/FavoriteButton', () => ({ default: () => null }));
// 지면은 자리 표시만 남긴다 — 어느 상세에 attraction-end 가 그려지는지 본다
vi.mock('../../../components/ads/AdSlot', () => ({
  default: ({ placement }: { placement: string }) => <div data-ad-placement={placement} />,
}));
vi.mock('../../../analytics/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../analytics/tracker')>()),
  track: vi.fn(),
}));

import { fetchAirQuality, fetchAttraction, fetchWeather, searchAttractions, type AirQuality, type WeatherOutlook } from '../../../api/placeApi';
import { track } from '../../../analytics/tracker';
import { todayKst } from '../../../seo/eventSchedule';
import AttractionPage from '../AttractionPage';

// 날씨는 따로 다루는 묶음 밖에서는 빈 응답 — 절이 없다
vi.mocked(fetchWeather).mockResolvedValue({ sigunguCode: '11110', shortBaseAt: null, midTmFc: null, days: [] });
const NO_AIR: AirQuality = { sigunguCode: '11110', stations: [] };
vi.mocked(fetchAirQuality).mockResolvedValue(NO_AIR);

// 화면 폭 — 기본은 좁은 화면(모바일). 넓은 화면이 필요한 테스트만 wide 를 켠다
let wide = false;
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: query.includes('min-width') ? wide : false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
})) as unknown as typeof window.matchMedia;

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
  similarElsewhere: [
    { id: '501', title: '경기전', sidoName: '전북특별자치도' },
    { id: '502', title: '화성행궁', sidoName: null },
  ],
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
/** 주변 탐색 목록의 줄 — 이름(표시 포함)만 */
const exploreNames = (section: HTMLElement) =>
  Array.from(section.querySelectorAll('.place-explore-name')).map((n) => n.textContent);
const searchCalls = () => vi.mocked(searchAttractions).mock.calls.map(([q]) => q as AttractionQuery);

describe('AttractionPage 새 섹션', () => {
  beforeEach(() => {
    vi.mocked(searchAttractions).mockImplementation((q) =>
      Promise.resolve({
        searchId: 's',
        // 주변 명소 응답에 자기 자신과 같은 분류 가까운 곳(201)이 섞여 온다
        // 근처 행사·숙소 검색(festival·stay)은 이 묶음에서 0건이다
        attractions: q.category?.includes('history')
          ? [card('100'), card('201'), card('301'), card('302')]
          : q.category?.includes('food')
            ? [card('401', 'food')]
            : [],
        totalElements: 4, totalPages: 1, currentPage: 0,
      }),
    );
  });
  afterEach(() => vi.clearAllMocks());

  it('개요·이용 안내 → 방문 정보 요약 → 지역 안 위치 → 주변 탐색 → 비슷한 곳 순서다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    await screen.findByText('명소 301');
    await screen.findByText('명소 401');

    // 같은 분류 가까운 곳 · 주변 명소 · 편의시설은 따로 절을 갖지 않는다 — 주변 탐색 하나로 합쳤다
    const order = ['이용 안내', '방문 정보 요약', '지역 안 위치', '주변 탐색', '비슷한 곳'];
    expect(h2Texts().filter((t) => order.includes(t ?? ''))).toEqual(order);
    for (const gone of ['같은 분류 가까운 곳', '주변 명소', '주변 편의시설']) expect(h2Texts()).not.toContain(gone);
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

  it('접근성 정보(원천: 무장애 여행)는 배지 뒤에 긍정 아이콘 줄과 원천 문장(원천 키 순서)으로, 웰니스는 한 줄로, 출처에 원천 이름을 붙인다', async () => {
    // 경복궁(126508) 운영 응답 원문(2026-10-02)의 값 있는 키 — 서버 렌더 테스트와 같은 원문
    vi.mocked(fetchAttraction).mockResolvedValue({
      ...enriched,
      barrierFree: ['PARKING', 'WHEELCHAIR', 'EXIT', 'RESTROOM', 'AUDIO_GUIDE', 'STROLLER', 'LACTATION_ROOM', 'INFANT_ETC'],
      barrierFreeDetail: {
        parking: '장애인 주차장 있음(광화문 우측 옥외 주차장에 9개)_무장애 편의시설',
        wheelchair: '대여가능',
        exit: '주출입구는 경사로가 있어 휠체어 접근 가능함',
        restroom: '장애인 화장실 있음',
        audioguide: '음성안내 가이드 있음(티켓박스에서 음성안내기기와 PDA 대여가능)',
        stroller: '대여가능',
        lactationroom: '수유실 있음(흥례문, 주차장 여자화장실 내부)',
        infantsfamilyetc: '기저귀교환대 있음(수유실, 일반화장실 내부)',
      },
      wellnessTheme: 'EX050100',
      wellnessThemeName: '온천 / 사우나 / 스파',
    });
    renderAt('/attractions/100');
    const section = await screen.findByRole('region', { name: '접근성 정보' });

    expect(within(section).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '휠체어', '장애인 화장실', '장애인 주차', '유모차', '수유실',
    ]);
    expect(Array.from(section.querySelectorAll('dt')).map((dt) => dt.textContent)).toEqual([
      '주차', '휠체어', '출입통로', '화장실', '오디오가이드', '유모차', '수유실', '영유아 가족 기타',
    ]);
    expect(within(section).getByText('주출입구는 경사로가 있어 휠체어 접근 가능함')).toBeInTheDocument();
    expect(screen.getByText('웰니스 관광 · 온천 / 사우나 / 스파')).toBeInTheDocument();
    expect(screen.getByText(/출처: 한국관광공사 TourAPI · 무장애 여행 정보 · 웰니스관광 정보/)).toBeInTheDocument();
    expect(within(section).getByText('접근성 상세 8항목')).toBeInTheDocument();
    const order = ['방문 정보 요약', '접근성 정보', '지역 안 위치'];
    expect(h2Texts().filter((t) => order.includes(t ?? ''))).toEqual(order);
  });

  it('접근성·웰니스 정보가 없으면 절이 없고 출처는 TourAPI 만이다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    await screen.findByRole('region', { name: '방문 정보 요약' });

    expect(screen.queryByRole('region', { name: '접근성 정보' })).toBeNull();
    expect(document.querySelector('[data-place-section="wellness"]')).toBeNull();
    expect(screen.getByText(/출처: 한국관광공사 TourAPI · GeoNames/)).toBeInTheDocument();
  });

  it('14일 고유 클릭 방문자가 최소 표본(5)에 닿으면 배지 끝에 「많이 클릭한 곳」을 붙인다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, uniqueClickers14d: 5 });
    renderAt('/attractions/100');
    const badges = await screen.findByRole('region', { name: '방문 정보 요약' });

    expect(within(badges).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '매주 화요일 휴무', '주차 가능', '유모차 대여 없음', '입장 유료', '많이 클릭한 곳',
    ]);
  });

  it('최소 표본 미만이거나 값이 없으면 「많이 클릭한 곳」을 붙이지 않는다', async () => {
    for (const n of [4, 0, null]) {
      vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, uniqueClickers14d: n });
      const { unmount } = renderAt('/attractions/100');
      const badges = await screen.findByRole('region', { name: '방문 정보 요약' });
      expect(within(badges).queryByText('많이 클릭한 곳')).toBeNull();
      unmount();
    }
  });

  it('지역 문구와 시군구 허브 링크를 그리고, 같은 분류 가까운 곳은 주변 탐색 줄에 표시로 남긴다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    const region = await screen.findByRole('region', { name: '지역 안 위치' });

    expect(within(region).getByText('종로구 관광지 40곳 중 고궁 7곳')).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: '종로구 둘러보기' })).toHaveAttribute('href', '/regions/11110');
    const explore = await screen.findByRole('region', { name: '주변 탐색' });
    await within(explore).findByText('명소 401');
    // 201 은 주변 명소에도 와서 그 줄(좌표 있음)에 표시가 붙고, 202 는 같은 분류에만 있어 좌표 없이 붙는다
    expect(exploreNames(explore)).toEqual(['경희궁같은 분류', '명소 201같은 분류', '명소 301', '명소 302', '명소 401']);
    const sameRow = within(explore).getByText('경희궁').closest('a')!;
    expect(sameRow).toHaveAttribute('href', '/attractions/202');
    expect(sameRow.querySelector('[data-unmapped]')).not.toBeNull();
  });

  it('비슷한 곳은 상세 링크와 시도 이름으로 그린다 — 서버 렌더와 같은 제목', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    const similar = await screen.findByRole('region', { name: '비슷한 곳' });

    const links = within(similar).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['경기전전북특별자치도', '화성행궁']);
    expect(links[0]).toHaveAttribute('href', '/attractions/501');
  });

  it('좁은 화면 목록은 처음 8줄과 「목록 더 보기」, 넓은 화면은 전부다', async () => {
    // 편의시설은 종류당 6곳까지라 음식 6 · 쇼핑 6 으로 12곳
    const many = Array.from({ length: 12 }, (_, i) => card(String(600 + i), i < 6 ? 'food' : 'shopping'));
    vi.mocked(searchAttractions).mockImplementation((q) =>
      Promise.resolve({
        searchId: 's',
        attractions: q.category?.includes('food') ? many : [],
        totalElements: 12, totalPages: 1, currentPage: 0,
      }),
    );
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, region: undefined });
    renderAt('/attractions/100');
    let explore = await screen.findByRole('region', { name: '주변 탐색' });
    await within(explore).findByText('명소 600');
    expect(exploreNames(explore)).toHaveLength(8);
    fireEvent.click(within(explore).getByRole('button', { name: '목록 더 보기 (4)' }));
    expect(exploreNames(explore)).toHaveLength(12);
    cleanup();

    wide = true;
    try {
      renderAt('/attractions/100');
      explore = await screen.findByRole('region', { name: '주변 탐색' });
      await within(explore).findByText('명소 611');
      expect(exploreNames(explore)).toHaveLength(12);
      expect(within(explore).queryByRole('button', { name: /목록 더 보기/ })).toBeNull();
    } finally {
      wide = false;
    }
  });

  it('노출 섹션 번호는 출처 목록 그대로다 — 같은 분류 0 · 비슷한 곳 1 · 주변 명소 2 · 편의시설 3', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    const rows: Array<[string, string]> = [
      ['주변 탐색', '경희궁'], ['주변 탐색', '명소 201'], ['비슷한 곳', '경기전'], ['주변 탐색', '명소 301'], ['주변 탐색', '명소 401'],
    ];
    const clicked: Array<[string | undefined, number | undefined]> = [];
    for (const [name, title] of rows) {
      renderAt('/attractions/100');
      const section = await screen.findByRole('region', { name });
      const link = (await within(section).findByText(title)).closest('a')!;
      vi.mocked(track).mockClear();
      fireEvent.click(link);
      const click = vi.mocked(track).mock.calls.find(([action]) => action === 'CLICK')!;
      clicked.push([click[1].sectionId, click[1].sectionIndex]);
      cleanup();
    }

    expect(clicked).toEqual([
      ['SAME_CATEGORY_NEARBY', 0], ['SAME_CATEGORY_NEARBY', 0], ['SIMILAR_ELSEWHERE', 1], ['NEARBY_ATTRACTIONS', 2], ['AMENITY_CAROUSEL', 3],
    ]);
  });

  it('주변 탐색 — 자기 자신은 없고 같은 곳은 한 번만, 번호는 거리순이며 칩이 목록을 거른다', async () => {
    // 편의시설 응답에도 자기 자신(100)과 명소에 이미 온 곳(301)이 섞여 온다 — 목록 사이 중복
    vi.mocked(searchAttractions).mockImplementation((q) =>
      Promise.resolve({
        searchId: 's',
        attractions: q.category?.includes('history')
          ? [card('100'), card('201'), card('301'), card('302')]
          : q.category?.includes('food')
            ? [card('100', 'food'), card('301', 'food'), card('401', 'food')]
            : [],
        totalElements: 4, totalPages: 1, currentPage: 0,
      }),
    );
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    const explore = await screen.findByRole('region', { name: '주변 탐색' });
    await within(explore).findByText('명소 401');

    expect(within(explore).queryByText('명소 100')).toBeNull();
    expect(within(explore).getAllByText('명소 201')).toHaveLength(1);
    expect(within(explore).getAllByText('명소 301')).toHaveLength(1);
    // 경희궁 800m 이 먼저, 그다음 1km 넷이 받은 순서로 — 번호도 그 순서다
    expect(Array.from(explore.querySelectorAll('.place-explore-num')).map((n) => n.textContent)).toEqual(['1', '2', '3', '4', '5']);
    expect(within(explore).getByRole('button', { name: /전체 5/ })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(explore).getByRole('button', { name: /편의시설 1/ }));
    expect(exploreNames(explore)).toEqual(['명소 401']);
    fireEvent.click(within(explore).getByRole('button', { name: /명소 4/ }));
    expect(exploreNames(explore)).toEqual(['경희궁같은 분류', '명소 201같은 분류', '명소 301', '명소 302']);
  });

  it('상세의 주변·편의시설·근처 행사·근처 숙소 검색은 건수를 요청하지 않는다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    await screen.findByText('명소 401');

    expect(searchCalls()).toHaveLength(4);
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
    expect(await screen.findByRole('region', { name: 'Explore nearby' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Similar places in other regions' })).toBeInTheDocument();
  });

  it('유형 코드가 없으면 지역 문구를 짐작하지 않는다 — 허브 링크만 둔다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, contentTypeId: undefined });
    renderAt('/attractions/100');
    const region = await screen.findByRole('region', { name: '지역 안 위치' });

    expect(within(region).queryByText(/곳 중/)).toBeNull();
    expect(within(region).getByRole('link', { name: '종로구 둘러보기' })).toBeInTheDocument();
  });

  it('속성·지역이 없는 옛 문서는 새 섹션을 하나도 그리지 않고 주변 탐색은 그대로다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...card('100'), title: '옛 문서', overview: '개요' });
    renderAt('/attractions/100');
    await screen.findByText('명소 201');

    expect(screen.queryByRole('region', { name: '방문 정보 요약' })).toBeNull();
    expect(screen.queryByRole('region', { name: '지역 안 위치' })).toBeNull();
    expect(screen.queryByRole('region', { name: '비슷한 곳' })).toBeNull();
    expect(h2Texts()).toContain('주변 탐색');
    expect(screen.queryByText('같은 분류')).toBeNull();
  });
});

describe('AttractionPage 유형별 본문 — 행사 · 숙박 · 여행코스', () => {
  // 오늘 = 2026-10-26(월) KST. Date 만 고정한다.
  const NOW = new Date('2026-10-26T03:00:00Z');
  const event: Attraction = {
    ...card('300', 'festival'),
    title: '불꽃축제',
    overview: '가을 밤 불꽃 축제다.',
    contentTypeId: '15',
    eventStart: '2026-10-30',
    eventEnd: '2026-11-02',
    useTime: '19:00',
    introRaw: JSON.stringify({ eventplace: '여의도 <b>한강공원</b>', playtime: '19:00~21:00', sponsor1: '한화', eventhomepage: 'x' }),
  };
  const stay: Attraction = {
    ...card('310', 'stay'),
    title: '한옥 스테이',
    overview: '한옥 숙소.',
    contentTypeId: '32',
    introRaw: JSON.stringify({
      checkintime: '15:00', checkouttime: '11:00', roomcount: '5',
      reservationurl: 'https://booking.example.com/r', reservationlodging: '예약 안내 02-000-0000',
    }),
  };
  const course: Attraction = {
    ...card('320', 'course'),
    title: '바다 하루 코스',
    overview: '바다를 따라 걷는다.',
    contentTypeId: '25',
    introRaw: '{"distance":"12.5km","taketime":"당일"}',
    infoRaw: '[{"subname":"원문 코스 줄"}]',
    courseStops: [
      { order: 0, contentId: '1', name: '해운대해수욕장', attractionId: 7001 },
      { order: 1, contentId: '2', name: '광안리 카페거리', attractionId: null },
      { order: 2, contentId: '3', name: '감천문화마을', attractionId: 7003 },
    ],
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.mocked(searchAttractions).mockResolvedValue({ searchId: 's', attractions: [], totalElements: 0, totalPages: 0, currentPage: 0 });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    document.head.innerHTML = '';
  });

  const rows = (section: HTMLElement) =>
    Array.from(section.querySelectorAll('.place-detail-info-row')).map((r) => [
      r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent,
    ]);
  const adPlacements = () => Array.from(document.querySelectorAll('[data-ad-placement]')).map((e) => e.getAttribute('data-ad-placement'));

  it('행사 — 상태 문구와 기간·장소·시간·주최를 서버와 같은 라벨로 그리고, 일반 이용 안내는 그리지 않는다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(event);
    renderAt('/attractions/300');
    const section = await screen.findByRole('region', { name: '행사 정보' });

    expect(within(section).getByText('D-4 시작')).toBeInTheDocument();
    expect(rows(section)).toEqual([
      ['기간', '2026-10-30 ~ 2026-11-02'], ['행사 장소', '여의도 한강공원'], ['공연 시간', '19:00~21:00'], ['주최', '한화'],
    ]);
    expect(screen.queryByRole('region', { name: '이용 안내' })).toBeNull();
    expect(section).toHaveAttribute('data-place-section', 'event');
  });

  it('행사 영문 — Event info · Starts in n days', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...event, lang: 'en', contentTypeId: '85' });
    renderAt('/en/attractions/300');
    const section = await screen.findByRole('region', { name: 'Event info' });
    expect(within(section).getByText('Starts in 4 days')).toBeInTheDocument();
    expect(rows(section)[0]).toEqual(['Dates', '2026-10-30 ~ 2026-11-02']);
  });

  it('숙박 — 허용 목록 키만 그린다. 예약 URL·예약 안내는 입력에 있어도 나가지 않는다', async () => {
    expect(JSON.parse(stay.introRaw!)).toHaveProperty('reservationurl');
    vi.mocked(fetchAttraction).mockResolvedValue(stay);
    renderAt('/attractions/310');
    const section = await screen.findByRole('region', { name: '숙박 정보' });

    expect(rows(section)).toEqual([['입실', '15:00'], ['퇴실', '11:00'], ['객실 수', '5']]);
    expect(document.body.textContent).not.toContain('booking.example.com');
    expect(document.body.textContent).not.toContain('예약 안내 02-000-0000');
  });

  it('여행코스 — 원천 순서 그대로, 이어진 지점만 상세로 링크한다. 반복정보 원문 줄은 그리지 않는다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(course);
    renderAt('/attractions/320');
    const section = await screen.findByRole('region', { name: '코스 구성' });

    expect(rows(section)).toEqual([['총 거리', '12.5km'], ['소요 시간', '당일']]);
    const items = within(section).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['해운대해수욕장', '광안리 카페거리', '감천문화마을']);
    expect(within(items[0]).getByRole('link')).toHaveAttribute('href', '/attractions/7001');
    expect(within(items[1]).queryByRole('link')).toBeNull();
    expect(screen.queryByText('원문 코스 줄')).toBeNull();
  });

  it('새 유형 상세에는 attraction-end 지면이 없다 — 관광지 상세는 그대로 있다(대조)', async () => {
    for (const [doc, path] of [[event, '/attractions/300'], [stay, '/attractions/310'], [course, '/attractions/320']] as const) {
      vi.mocked(fetchAttraction).mockResolvedValue(doc);
      renderAt(path);
      await screen.findByRole('heading', { level: 1, name: doc.title });
      expect(adPlacements(), doc.contentTypeId!).toEqual([]);
      cleanup();
    }
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    expect(adPlacements()).toEqual(['attraction-end']);
  });

  it('유형별 JSON-LD 와 제목을 심고, 끝난 지 31일이 지난 행사는 noindex 다(서버 렌더와 같은 판정)', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(event);
    renderAt('/attractions/300');
    await screen.findByRole('region', { name: '행사 정보' });
    const types = () =>
      Array.from(document.head.querySelectorAll('script[type="application/ld+json"]')).map((el) => JSON.parse(el.textContent!)['@type']);
    expect(types()).toContain('Event');
    expect(document.title).toBe('불꽃축제 행사 정보 — 일정 · 장소 · 주변 가볼 만한 곳 | K-관광');
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
    cleanup();

    // 종료 2026-09-25 + 31일 = 10-26(오늘) → 만료. 하루 늦게 끝난 행사(+30)는 아직 색인 대상
    vi.mocked(fetchAttraction).mockResolvedValue({ ...event, id: '301', eventStart: '2026-09-20', eventEnd: '2026-09-25' });
    renderAt('/attractions/301');
    await screen.findByText('종료된 행사');
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    cleanup();

    vi.mocked(fetchAttraction).mockResolvedValue({ ...event, id: '302', eventStart: '2026-09-20', eventEnd: '2026-09-26' });
    renderAt('/attractions/302');
    await screen.findByText('종료된 행사');
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('같은 분류 가까운 곳·비슷한 곳에서 오늘 이전에 끝난 행사 항목은 거른다 — 오늘 끝나는 항목은 남긴다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({
      ...enriched,
      region: {
        ...enriched.region!,
        sameCategoryNearby: [
          { id: '201', title: '어제 끝난 축제', distanceMeters: 500, eventEndEffective: '2026-10-25' },
          { id: '202', title: '오늘 끝나는 축제', distanceMeters: 600, eventEndEffective: '2026-10-26' },
          { id: '203', title: '창덕궁', distanceMeters: 700, eventEndEffective: null },
        ],
      },
      similarElsewhere: [{ id: '501', title: '끝난 행사', sidoName: null, eventEndEffective: '2026-01-01' }],
    });
    renderAt('/attractions/100');
    const explore = await screen.findByRole('region', { name: '주변 탐색' });
    expect(exploreNames(explore)).toEqual(['오늘 끝나는 축제같은 분류', '창덕궁같은 분류']);
    expect(screen.queryByRole('region', { name: '비슷한 곳' })).toBeNull();
  });
});

describe('AttractionPage 근처 행사 · 근처 숙소', () => {
  const NOW = new Date('2026-10-26T03:00:00Z');
  const ev = (id: string, start: string, end: string, km = 3): Attraction => ({
    ...card(id, 'festival'), title: `행사 ${id}`, contentTypeId: '15', eventStart: start, eventEnd: end, distanceKm: km,
  });
  const st = (id: string, km = 1): Attraction => ({ ...card(id, 'stay'), title: `숙소 ${id}`, contentTypeId: '32', distanceKm: km });

  /** 분류 조건을 실제로 따르는 가짜 검색 — 편의시설 분류에 stay 가 다시 들어가면 숙소가 거기에도 온다. */
  function respond(byCategory: Record<string, Attraction[]>) {
    vi.mocked(searchAttractions).mockImplementation((q) => {
      const cats = (q.category ?? '').split(',');
      const attractions = cats.flatMap((c) => byCategory[c] ?? []);
      return Promise.resolve({ searchId: 's', attractions, totalElements: attractions.length, totalPages: 1, currentPage: 0 });
    });
  }
  const callFor = (category: string) => searchCalls().find((q) => q.category === category);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('근처 행사 — 반경 20km · 끝나지 않은 행사 · 시작일 순으로 받고, 자기 자신을 빼고 최대 6건을 거리·기간과 그린다', async () => {
    const events = [ev('300', '2026-10-20', '2026-10-30'), ...['601', '602', '603', '604', '605', '606', '607'].map((id, i) => ev(id, `2026-11-0${i + 1}`, `2026-11-0${i + 2}`, 2.5))];
    respond({ festival: events, history: [card('301')] });
    vi.mocked(fetchAttraction).mockResolvedValue({ ...ev('300', '2026-10-20', '2026-10-30'), title: '불꽃축제', overview: '개요' });
    renderAt('/attractions/300');
    const explore = await screen.findByRole('region', { name: '주변 탐색' });
    await within(explore).findByText('행사 601');

    expect(callFor('festival')).toMatchObject({
      lat: 37.5, lng: 127, radiusKm: 20, category: 'festival', eventStatus: 'NOT_ENDED', sort: 'eventStart',
    });
    fireEvent.click(within(explore).getByRole('button', { name: /행사 6/ }));
    expect(exploreNames(explore)).toEqual(['행사 601', '행사 602', '행사 603', '행사 604', '행사 605', '행사 606']);
    const first = within(explore).getByText('행사 601').closest('a')!;
    expect(first).toHaveAttribute('href', '/attractions/601');
    expect(within(first).getByText('2.5km')).toBeInTheDocument();
    expect(within(first).getByText('2026-11-01 ~ 2026-11-02')).toBeInTheDocument();
  });

  it('근처 숙소 — 반경 5km · 거리순으로 받고 자기 자신을 빼고 최대 6건이다', async () => {
    const stays = [st('310', 0), ...['701', '702', '703', '704', '705', '706', '707'].map((id, i) => st(id, 0.3 + i / 10))];
    respond({ stay: stays });
    vi.mocked(fetchAttraction).mockResolvedValue({ ...st('310', 0), title: '한옥 스테이' });
    renderAt('/attractions/310');
    const explore = await screen.findByRole('region', { name: '주변 탐색' });
    await within(explore).findByText('숙소 701');

    expect(callFor('stay')).toMatchObject({ lat: 37.5, lng: 127, radiusKm: 5, category: 'stay', sort: 'distance' });
    expect(exploreNames(explore)).toEqual(['숙소 701', '숙소 702', '숙소 703', '숙소 704', '숙소 705', '숙소 706']);
    expect(within(within(explore).getByText('숙소 701').closest('a')!).getByText('300m')).toBeInTheDocument();
  });

  it('편의시설 검색에는 숙박이 없고, 같은 숙소는 한 화면에 한 번만 뜬다', async () => {
    respond({ food: [card('401', 'food')], shopping: [card('402', 'shopping')], stay: [st('701')] });
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    const explore = await screen.findByRole('region', { name: '주변 탐색' });
    await within(explore).findByText('숙소 701');
    await within(explore).findByText('명소 401');

    const amenityCall = searchCalls().find((q) => q.category.includes('food'))!;
    expect(amenityCall.category.split(',')).not.toContain('stay');
    expect(screen.getAllByText('숙소 701')).toHaveLength(1);
  });

  it('숙박 상세 — 같은 분류 가까운 곳에 든 숙소는 한 줄로, 표시를 붙여 남긴다', async () => {
    respond({ stay: [st('310', 0), st('701'), st('702')] });
    vi.mocked(fetchAttraction).mockResolvedValue({
      ...st('310', 0),
      title: '한옥 스테이',
      region: { ...enriched.region!, sameCategoryNearby: [{ id: '701', title: '숙소 701', distanceMeters: 1000 }] },
    });
    renderAt('/attractions/310');
    const explore = await screen.findByRole('region', { name: '주변 탐색' });
    await within(explore).findByText('숙소 702');

    expect(exploreNames(explore)).toEqual(['숙소 701같은 분류', '숙소 702']);
  });

  it('결과가 0건이거나 자기 자신뿐이면 행사·숙소 칩이 없다', async () => {
    respond({ festival: [ev('300', '2026-10-20', '2026-10-30')], history: [card('301')] });
    vi.mocked(fetchAttraction).mockResolvedValue({ ...ev('300', '2026-10-20', '2026-10-30'), title: '불꽃축제' });
    renderAt('/attractions/300');
    const explore = await screen.findByRole('region', { name: '주변 탐색' });
    await within(explore).findByText('명소 301');

    expect(within(explore).queryByRole('button', { name: /행사/ })).toBeNull();
    expect(within(explore).queryByRole('button', { name: /숙소/ })).toBeNull();
  });

  it('영문 화면 — Explore nearby · Events · Stays', async () => {
    respond({ festival: [ev('601', '2026-11-01', '2026-11-02')], stay: [st('701')] });
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, lang: 'en' });
    renderAt('/en/attractions/100');
    const explore = await screen.findByRole('region', { name: 'Explore nearby' });
    expect(await within(explore).findByRole('button', { name: /Events 1/ })).toBeInTheDocument();
    expect(within(explore).getByRole('button', { name: /Stays 1/ })).toBeInTheDocument();
  });

  it('노출 기록 섹션 식별자는 NEARBY_EVENTS · NEARBY_STAYS 이고 화면 번호는 기존 넷 다음이다', async () => {
    respond({ festival: [ev('601', '2026-11-01', '2026-11-02')], stay: [st('701')] });
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    const clicked: Array<[string | undefined, number | undefined, string | undefined]> = [];
    for (const title of ['행사 601', '숙소 701']) {
      renderAt('/attractions/100');
      const section = await screen.findByRole('region', { name: '주변 탐색' });
      const link = (await within(section).findByText(title)).closest('a')!;
      vi.mocked(track).mockClear();
      fireEvent.click(link);
      const click = vi.mocked(track).mock.calls.find(([action]) => action === 'CLICK')!;
      clicked.push([click[1].sectionId, click[1].sectionIndex, click[1].entityId]);
      cleanup();
    }
    expect(clicked).toEqual([['NEARBY_EVENTS', 5, '601'], ['NEARBY_STAYS', 4, '701']]);
  });
});

describe('AttractionPage 날씨', () => {
  const today = todayKst();
  const plus = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  const outlook: WeatherOutlook = {
    sigunguCode: '11110',
    shortBaseAt: `${today}T05:00`,
    midTmFc: `${today}T06:00`,
    days: [
      // 서버가 이미 거른 뒤지만, 자정을 넘겨 화면에 남은 어제 날은 화면도 그리지 않는다
      { date: plus(-1), source: 'SHORT', min: 1, max: 2, am: null, pm: { sky: '맑음', pop: 0 }, allDay: null },
      { date: today, source: 'SHORT', min: null, max: 22, am: { sky: '맑음', pop: 0 }, pm: { sky: '흐리고 비', pop: 60 }, allDay: null },
      { date: plus(1), source: 'SHORT', min: 11, max: 23, am: { sky: '구름많음', pop: 20 }, pm: { sky: '구름많음', pop: 30 }, allDay: null },
      { date: plus(10), source: 'MID', min: 15, max: 24, am: null, pm: null, allDay: { sky: '구름많음', pop: 20 } },
    ],
  };

  beforeEach(() => {
    vi.mocked(searchAttractions).mockResolvedValue({ searchId: 's', attractions: [], totalElements: 0, totalPages: 0, currentPage: 0 });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(fetchWeather).mockResolvedValue({ sigunguCode: '11110', shortBaseAt: null, midTmFc: null, days: [] });
  });

  it('「종로구 날씨」 — 시군구 코드로 부르고, 시군구 단위임을 밝히고, 오늘부터 그리며 출처 「기상청」과 발표 시각을 단다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    vi.mocked(fetchWeather).mockResolvedValue(outlook);
    renderAt('/attractions/100');
    const section = await screen.findByRole('region', { name: '종로구 날씨' });

    expect(fetchWeather).toHaveBeenCalledWith('11110');
    expect(within(section).getByText(/종로구 단위 예보/)).toBeInTheDocument();
    const days = within(section).getAllByRole('listitem');
    expect(days).toHaveLength(3);
    expect(days[0].textContent).toContain('오늘');
    expect(days[0].textContent).toContain('흐리고 비');
    expect(days[0].textContent).toContain('60%');
    // 원천에 없는 최저는 0 이 아니라 빈칸
    expect(days[0].textContent).toContain('– / 22°');
    expect(days[1].textContent).toContain('내일');
    // 중기 8~10일은 하루 하나
    expect(days[2].getAttribute('data-weather-source')).toBe('MID');
    expect(days[2].textContent).not.toContain('오전');
    expect(days[2].textContent).toContain('15° / 24°');
    expect(within(section).getByText(/출처: 기상청 단기예보·중기예보/).textContent).toMatch(/단기 \d+월 \d+일 05:00 발표 · 중기 \d+월 \d+일 06:00 발표/);
  });

  it('날이 하나도 없으면(신선도 초과 · 매핑 없는 시군구) 절을 그리지 않는다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    await screen.findByRole('region', { name: '지역 안 위치' });
    await vi.waitFor(() => expect(fetchWeather).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: '종로구 날씨' })).toBeNull();
  });

  it('시군구를 모르는 문서는 날씨를 부르지 않는다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, region: undefined });
    renderAt('/attractions/100');
    await screen.findByText('조선의 법궁이다.');
    expect(fetchWeather).not.toHaveBeenCalled();
  });

  it('영문 화면 — Weather in … · 기상청 표현을 영문으로, 모르는 표현은 원문 그대로', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, lang: 'en', region: { ...enriched.region!, sigunguName: 'Jongno-gu' } });
    vi.mocked(fetchWeather).mockResolvedValue({
      ...outlook,
      days: [{ ...outlook.days[1], pm: { sky: '흐리고 비', pop: 60 }, am: { sky: '안개', pop: null } }],
    });
    renderAt('/en/attractions/100');
    const section = await screen.findByRole('region', { name: 'Weather in Jongno-gu' });
    expect(section.textContent).toContain('Today');
    expect(section.textContent).toContain('Cloudy, rain');
    expect(section.textContent).toContain('안개');
    expect(section.textContent).toContain('Korea Meteorological Administration');
  });
});

describe('AttractionPage 대기질', () => {
  // 관광지는 (37.5, 127) — 후보 셋 중 「종로」가 약 2.2km 로 가장 가깝다. 값·등급·Flag 는 세종 조치원읍 운영 응답(2026-10-02 21:00) 모양
  const jongno = {
    name: '종로',
    latitude: 37.52,
    longitude: 127.0,
    measurement: {
      sidoName: '서울',
      dataTime: '2026-10-02T21:00',
      pm10: { value: '34', grade: '2', flag: null },
      pm25: { value: '-', grade: null, flag: '통신장애' },
    },
  };
  const far = { ...jongno, name: '중구', latitude: 37.564639, longitude: 126.975961,
    measurement: { ...jongno.measurement, pm10: { value: '99', grade: '4', flag: null } } };
  const air: AirQuality = { sigunguCode: '11110', stations: [far, jongno, { ...jongno, name: '평창', latitude: 37.37, longitude: 128.39 }] };

  beforeEach(() => {
    vi.mocked(searchAttractions).mockResolvedValue({ searchId: 's', attractions: [], totalElements: 0, totalPages: 0, currentPage: 0 });
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(fetchWeather).mockResolvedValue({ sigunguCode: '11110', shortBaseAt: null, midTmFc: null, days: [] });
    vi.mocked(fetchAirQuality).mockResolvedValue(NO_AIR);
  });

  it('시군구 코드로 부르고 — 측정소 이름 · 이 장소에서의 거리 · 원천 등급과 값 그대로 · Flag 면 값 대신 원천 표시 · 출처와 측정 시각', async () => {
    vi.mocked(fetchAirQuality).mockResolvedValue(air);
    renderAt('/attractions/100');
    const section = await screen.findByRole('region', { name: '대기질' });

    expect(fetchAirQuality).toHaveBeenCalledWith('11110');
    // 후보 중 가장 가까운 측정소 하나만 — 다른 후보의 값(중구 99 · 매우나쁨)을 섞지 않는다
    expect(within(section).getByText('종로 측정소 · 이 장소에서 2.2km')).toBeInTheDocument();
    expect(section.textContent).not.toContain('99');
    const rows = within(section).getAllByRole('listitem');
    expect(rows[0].textContent).toBe('미세먼지(PM10)보통34㎍/㎥');
    // 통신장애 — 값 「-」 를 0 이나 빈 등급으로 그리지 않고 원천 표시만
    expect(rows[1].textContent).toBe('초미세먼지(PM2.5)통신장애');
    expect(within(section).getByText(/출처: 한국환경공단 에어코리아 — 실시간 측정값으로 확정 전 자료/).textContent).toContain('10월 2일 21:00 측정');
  });

  it.each([
    ['가장 가까운 측정소에 측정이 없으면(3시간 초과는 서버가 뺀다) — 더 먼 측정소로 넘어가지 않는다', { ...air, stations: [far, { ...jongno, measurement: null }] }],
    ['후보 전이면', NO_AIR],
    ['가장 가까운 측정소가 20km 를 넘게 멀면', { ...air, stations: [{ ...jongno, latitude: 37.9 }] }],
  ])('%s 절을 그리지 않는다', async (_, value) => {
    vi.mocked(fetchAirQuality).mockResolvedValue(value as AirQuality);
    renderAt('/attractions/100');
    await screen.findByRole('region', { name: '지역 안 위치' });
    await vi.waitFor(() => expect(fetchAirQuality).toHaveBeenCalled());
    expect(screen.queryByRole('region', { name: '대기질' })).toBeNull();
  });

  it('영문 화면 — 등급은 영문으로, Flag 는 원천 표기 그대로', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, lang: 'en' });
    vi.mocked(fetchAirQuality).mockResolvedValue(air);
    renderAt('/en/attractions/100');
    const section = await screen.findByRole('region', { name: 'Air quality' });
    expect(section.textContent).toContain('Moderate');
    expect(section.textContent).toContain('통신장애');
    expect(section.textContent).toContain('AirKorea');
  });
});

describe('AttractionPage 혼잡 예측', () => {
  const today = todayKst();
  const plus = (n: number) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

  beforeEach(() => {
    vi.mocked(searchAttractions).mockResolvedValue({ searchId: 's', attractions: [], totalElements: 0, totalPages: 0, currentPage: 0 });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(fetchWeather).mockResolvedValue({ sigunguCode: '11110', shortBaseAt: null, midTmFc: null, days: [] });
  });

  it('오늘부터 막대로 그리고(어제는 그리지 않는다), 높이는 집중률 그대로 · 오늘 표시 · 예측 안내와 출처를 단다', async () => {
    // 해운대해수욕장 운영 응답(2026-10-02) 앞 사흘 값 — 색인이 자정을 넘겨 어제 날이 남은 모양
    vi.mocked(fetchAttraction).mockResolvedValue({
      ...enriched,
      congestion: [
        { date: plus(-1), rate: 50 },
        { date: today, rate: 84.23 },
        { date: plus(1), rate: 98.14 },
      ],
    });
    renderAt('/attractions/100');
    const section = await screen.findByRole('region', { name: '혼잡 예측' });

    const bars = within(section).getAllByRole('listitem');
    expect(bars).toHaveLength(2);
    expect(bars[0].getAttribute('aria-current')).toBe('date');
    expect(bars[0].getAttribute('aria-label')).toMatch(/^오늘 \d+월 \d+일 \(.\) — 집중률 84\.2$/);
    expect(bars[1].getAttribute('aria-label')).toContain('집중률 98.1');
    expect((bars[1].querySelector('.place-congestion-fill') as HTMLElement).style.height).toBe('98.14%');
    expect(section.textContent).not.toContain('집중률 50');
    expect(within(section).getByText(/오늘 집중률 84\.2 · 가장 높은 날/)).toBeInTheDocument();
    expect(within(section).getByText(/예측값/)).toBeInTheDocument();
    expect(within(section).getByText('출처: 한국관광공사 빅데이터 서비스(관광지 집중률 예측)')).toBeInTheDocument();
  });

  it('남은 날이 모두 오늘 이전이면 절을 그리지 않는다(0 으로 그리지 않는다)', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, congestion: [{ date: plus(-2), rate: 40 }, { date: plus(-1), rate: 60 }] });
    renderAt('/attractions/100');
    await screen.findByText('조선의 법궁이다.');
    expect(screen.queryByRole('region', { name: '혼잡 예측' })).toBeNull();
  });

  it('집중률이 없는 문서는 절이 없다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    await screen.findByText('조선의 법궁이다.');
    expect(screen.queryByRole('region', { name: '혼잡 예측' })).toBeNull();
  });
});

describe('AttractionPage 여기 온 사람들이 함께 간 곳', () => {
  // 해운대해수욕장 202608 운영 응답에서 place 가 고른 앞의 세 곳(순위 1 · 2 · 4) — 광안리해수욕장은 비슷한 곳에도 있다
  const related = [
    { rank: 1, id: '3063', title: '광안리해수욕장', sidoName: '부산광역시', category: '자연경관(하천/해양)' },
    { rank: 2, id: '8', title: '해동용궁사', sidoName: '부산광역시', category: '종교성지' },
    { rank: 4, id: '7670', title: '송정해수욕장', sidoName: '부산광역시', category: null },
  ];
  const withRelated: Attraction = {
    ...enriched,
    similarElsewhere: [{ id: '3063', title: '광안리해수욕장', sidoName: '부산광역시' }, ...(enriched.similarElsewhere ?? [])],
    relatedPlaces: related,
  };

  beforeEach(() => {
    vi.mocked(searchAttractions).mockResolvedValue({ searchId: 's', attractions: [], totalElements: 0, totalPages: 0, currentPage: 0 });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('응답 목록을 그 순서 그대로 상세 링크와 원천 분류로 그린다(서버 렌더와 같은 목록) · 출처에 원천 이름', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(withRelated);
    renderAt('/attractions/100');
    fireEvent.click(await screen.findByRole('tab', { name: '여기 온 사람들이 함께 간 곳' }));
    const section = await screen.findByRole('region', { name: '여기 온 사람들이 함께 간 곳' });

    const links = within(section).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual(related.map((r) => `/attractions/${r.id}`));
    expect(links.map((a) => a.textContent)).toEqual(['광안리해수욕장자연경관(하천/해양)', '해동용궁사종교성지', '송정해수욕장']);
    expect(screen.getByText(/출처: 한국관광공사 TourAPI · 빅데이터 서비스\(연관 관광지\)/)).toBeInTheDocument();
  });

  it('비슷한 곳과 겹쳐도 두 탭이 각자 그린다 · 클릭은 RELATED_PLACES 섹션으로 남는다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(withRelated);
    renderAt('/attractions/100');
    // 처음은 비슷한 곳 탭이다
    const similar = await screen.findByRole('region', { name: '비슷한 곳' });
    expect(within(similar).getByText('광안리해수욕장')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '비슷한 곳' })).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(screen.getByRole('tab', { name: '여기 온 사람들이 함께 간 곳' }));
    const section = screen.getByRole('region', { name: '여기 온 사람들이 함께 간 곳' });
    expect(within(section).getByText('광안리해수욕장')).toBeInTheDocument();

    vi.mocked(track).mockClear();
    fireEvent.click(within(section).getByText('해동용궁사').closest('a')!);
    const click = vi.mocked(track).mock.calls.find(([action]) => action === 'CLICK')!;
    expect([click[1].sectionId, click[1].itemIndex, click[1].entityId]).toEqual(['RELATED_PLACES', 1, '8']);
  });

  it('목록이 없는 문서는 절이 없다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    await screen.findByText('조선의 법궁이다.');
    expect(screen.queryByRole('region', { name: '여기 온 사람들이 함께 간 곳' })).toBeNull();
    expect(screen.queryByText(/빅데이터 서비스/)).toBeNull();
  });
});
