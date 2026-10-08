import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attraction } from '../../../api/placeApi';

vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  searchAttractions: vi.fn(),
  fetchAttractionNearby: vi.fn(),
  fetchAttraction: vi.fn(),
  fetchWeather: vi.fn(),
  fetchAirQuality: vi.fn(),
}));
// 찜 대역은 계측 배선(`tracking`)만 드러낸다 — 어느 view·어느 관광지를 받았는지 본다
vi.mock('../../../components/favorite/FavoriteButton', () => ({
  default: ({ targetKey, tracking }: { targetKey: string; tracking?: { viewId: string; screenRef?: string } }) => (
    <button data-testid="fav" data-key={targetKey} data-view={tracking?.viewId} data-ref={tracking?.screenRef} />
  ),
}));
// 지면은 자리 표시만 남긴다 — 어느 상세에 attraction-end 가 그려지는지 본다
vi.mock('../../../components/ads/AdSlot', () => ({
  default: ({ placement }: { placement: string }) => <div data-ad-placement={placement} />,
}));
// 로그인 복귀의 찜 완료가 부르는 API — 실제 요청이 나가지 않게 막는다
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

import { fetchAirQuality, fetchAttraction, fetchAttractionNearby, fetchWeather, searchAttractions, type AirQuality, type WeatherOutlook } from '../../../api/placeApi';
import { track } from '../../../analytics/tracker';
import { addFavorite, fetchFavoriteKeys } from '../../../api/wishlistApi';
import { todayKst } from '../../../seo/eventSchedule';
import AttractionPage from '../AttractionPage';
import { googleMapsDirectionsUrl } from '../../rank/rankView';

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

/** 방문 요약 칸 — [이름, 값] */
const summaryRows = () =>
  Array.from(document.querySelectorAll('[data-place-section="visit-summary"] dt')).map((dt) => [
    dt.textContent, dt.nextElementSibling?.textContent,
  ]);
const badgeLine = () => document.querySelector('[data-place-section="visit-badges"]')?.textContent ?? null;
const h2Texts = () => screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
/** 지도 위 정보 탭 — 그 탭을 눌러 판을 연다(방문 정보가 처음 탭) */
async function openInfoTab(name: string) {
  fireEvent.click(await screen.findByRole('tab', { name }));
  return screen.getByRole('tabpanel', { name });
}
const infoTabs = () => Array.from(document.querySelectorAll('.place-info-tabs [role=tab]')).map((t) => t.textContent);
/** 주변 탐색 목록의 줄 — 이름(표시 포함)만 */
const exploreNames = (section: HTMLElement) =>
  Array.from(section.querySelectorAll('.place-explore-name')).map((n) => n.textContent);
/** 주변 탐색 응답 — 분류별로 무엇이 오는지 정한다. 서버가 명소·숙소·행사·편의시설 네 묶음으로 나눠 준다 */
function nearbyFrom(byCategory: (category: string) => Attraction[]) {
  vi.mocked(fetchAttractionNearby).mockImplementation(async () => ({
    sights: byCategory('nature,history,culture,leisure'),
    stays: byCategory('stay'),
    events: byCategory('festival'),
    amenities: byCategory('shopping,food'),
  }));
}

describe('AttractionPage 새 섹션', () => {
  beforeEach(() => {
            // 주변 명소 응답에 자기 자신과 같은 분류 가까운 곳(201)이 섞여 온다
        // 근처 행사·숙소 검색(festival·stay)은 이 묶음에서 0건이다
    nearbyFrom((c) =>
      c.includes('history')
          ? [card('100'), card('201'), card('301'), card('302')]
          : c.includes('food')
            ? [card('401', 'food')]
            : [],
    );
  });
  afterEach(() => vi.clearAllMocks());

  it('방문 요약 → 개요·이용 안내 → 정보 탭(방문 정보) → 주변 탐색 → 비슷한 곳 순서다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, parkingFee: '소형 2,000원' });
    renderAt('/attractions/100');
    await screen.findByText('명소 301');
    await screen.findByText('명소 401');

    // 같은 분류 가까운 곳 · 주변 명소 · 편의시설은 따로 절을 갖지 않는다 — 주변 탐색 하나로 합쳤다
    const order = ['이용 안내', '주변 탐색', '다른 지역의 비슷한 곳'];
    expect(h2Texts().filter((t) => order.includes(t ?? ''))).toEqual(order);
    expect(infoTabs()).toEqual(['방문 정보']);
    const explore = screen.getByRole('region', { name: '주변 탐색' });
    const tabs = document.querySelector('.place-info-tabs')!;
    expect(tabs.compareDocumentPosition(explore) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const summary = document.querySelector('[data-place-section="visit-summary"]')!;
    const info = screen.getByRole('region', { name: '이용 안내' });
    expect(summary.compareDocumentPosition(info) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    for (const gone of ['같은 분류 가까운 곳', '주변 명소', '주변 편의시설']) expect(h2Texts()).not.toContain(gone);
    const overview = screen.getByText('조선의 법궁이다.');
    const badges = screen.getByRole('tabpanel', { name: '방문 정보' });
    expect(overview.compareDocumentPosition(badges) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('<main> 은 하나이고 제목·본문을 품으며 머리말·바닥글은 밖이다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    await screen.findByText('명소 301');

    const mains = document.querySelectorAll('main');
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveClass('place-body', 'place-body-stacked');
    expect(mains[0].querySelector('h1')).not.toBeNull();
    expect(mains[0].querySelector('header, footer')).toBeNull();
  });

  it('일반 유형의 배지는 방문 요약 칸과 배지 줄로 옮겨 가고 정보 탭에는 남지 않는다 — 서버 렌더와 같은 문구', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    const tab = await screen.findByRole('tabpanel', { name: '방문 정보' });

    expect(summaryRows()).toContainEqual(['쉬는 날', '매주 화요일 휴무']);
    expect(summaryRows()).toContainEqual(['주차', '주차 가능']);
    expect(badgeLine()).toBe('유모차 대여 없음');
    for (const moved of ['매주 화요일 휴무', '주차 가능', '유모차 대여 없음', '입장 유료']) {
      expect(within(tab).queryByText(moved)).toBeNull();
    }
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
    const section = await openInfoTab('접근성 정보');

    // 긍정 아이콘 칩 다섯 + 원천 문장을 여는 칩 하나
    expect(within(section).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '휠체어', '장애인 화장실', '장애인 주차', '유모차', '수유실', '접근성 상세 8항목',
    ]);
    // 원천 문장은 처음에 접혀 있고(DOM 에는 있다) 칩을 누르면 편다
    const detail = section.querySelector('dl')!;
    expect(detail).not.toBeVisible();
    fireEvent.click(within(section).getByRole('button', { name: '접근성 상세 8항목' }));
    expect(detail).toBeVisible();
    expect(Array.from(section.querySelectorAll('dt')).map((dt) => dt.textContent)).toEqual([
      '주차', '휠체어', '출입통로', '화장실', '오디오가이드', '유모차', '수유실', '영유아 가족 기타',
    ]);
    expect(within(section).getByText('주출입구는 경사로가 있어 휠체어 접근 가능함')).toBeInTheDocument();
    expect(within(await openInfoTab('방문 정보')).getByText('웰니스 관광 · 온천 / 사우나 / 스파')).toBeInTheDocument();
    expect(screen.getByText(/출처: 한국관광공사 TourAPI · 무장애 여행 정보 · 웰니스관광 정보/)).toBeInTheDocument();
    expect(infoTabs()).toEqual(['방문 정보', '접근성 정보']);
  });

  it('접근성·웰니스 정보가 없으면 절이 없고 출처는 TourAPI 만이다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    await screen.findByRole('tabpanel', { name: '방문 정보' });

    expect(screen.queryByRole('tab', { name: '접근성 정보' })).toBeNull();
    expect(document.querySelector('[data-place-section="wellness"]')).toBeNull();
    expect(screen.getByText(/출처: 한국관광공사 TourAPI · GeoNames/)).toBeInTheDocument();
  });

  it('14일 고유 클릭 방문자가 최소 표본(5)에 닿으면 배지 줄 끝에 「많이 클릭한 곳」을 붙인다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, uniqueClickers14d: 5 });
    renderAt('/attractions/100');
    await screen.findByRole('tabpanel', { name: '방문 정보' });

    expect(badgeLine()).toBe('유모차 대여 없음 · 많이 클릭한 곳');
  });

  it('최소 표본 미만이거나 값이 없으면 「많이 클릭한 곳」을 붙이지 않는다', async () => {
    for (const n of [4, 0, null]) {
      vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, uniqueClickers14d: n });
      const { unmount } = renderAt('/attractions/100');
      await screen.findByRole('tabpanel', { name: '방문 정보' });
      expect(badgeLine()).toBe('유모차 대여 없음');
      unmount();
    }
  });

  it('사진 — 큰 사진 옆 타일은 6칸이고 마지막 칸에 남은 수, 누르면 전부 펴고 타일을 누르면 큰 사진이 바뀐다(아래 썸네일 줄 없음)', async () => {
    const urls = Array.from({ length: 10 }, (_, i) => `https://img.example/${i}.jpg`);
    vi.mocked(fetchAttraction).mockResolvedValue({
      ...enriched,
      imageUrl: urls[0],
      imagesRaw: JSON.stringify(urls.slice(1).map((u, i) => ({ originimgurl: u, imgname: `사진${i + 1}` }))),
    });
    renderAt('/attractions/100');
    const tiles = await screen.findByRole('group', { name: '사진' });

    expect(within(tiles).getAllByRole('button')).toHaveLength(6);
    expect(within(tiles).getByText('+3')).toBeInTheDocument();
    expect(document.querySelector('.place-gallery')).toBeNull();
    fireEvent.click(within(tiles).getByRole('button', { name: '사진 +3' }));
    expect(within(tiles).getAllByRole('button')).toHaveLength(9);

    fireEvent.click(within(tiles).getByRole('button', { name: '사진4' }));
    expect(document.querySelector('.place-detail-img')).toHaveAttribute('src', urls[4]);
    expect(screen.getByText('5 / 10')).toBeInTheDocument();
  });

  it('큰 사진을 누르면 크게 보기가 열리고, 좌우 버튼·방향키로 넘기며(끝에서 돈다) Esc 로 닫는다', async () => {
    const urls = Array.from({ length: 3 }, (_, i) => `https://img.example/${i}.jpg`);
    vi.mocked(fetchAttraction).mockResolvedValue({
      ...enriched,
      imageUrl: urls[0],
      imagesRaw: JSON.stringify(urls.slice(1).map((u, i) => ({ originimgurl: u, imgname: `사진${i + 1}` }))),
    });
    renderAt('/attractions/100');
    fireEvent.click(await screen.findByRole('button', { name: '사진 크게 보기' }));
    const viewer = screen.getByRole('dialog', { name: '사진 크게 보기' });
    const img = () => viewer.querySelector('.place-photo-viewer-img');

    expect(img()).toHaveAttribute('src', urls[0]);
    expect(within(viewer).getByRole('button', { name: '닫기' })).toHaveFocus();
    fireEvent.click(within(viewer).getByRole('button', { name: '다음 사진' }));
    expect(img()).toHaveAttribute('src', urls[1]);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(img()).toHaveAttribute('src', urls[2]);
    expect(within(viewer).getByText('3 / 3')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(img()).toHaveAttribute('src', urls[0]);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(img()).toHaveAttribute('src', urls[2]);
    fireEvent.click(within(viewer).getByRole('button', { name: '이전 사진' }));
    expect(img()).toHaveAttribute('src', urls[1]);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    // 넘긴 장이 상세의 큰 사진에도 남는다
    expect(document.querySelector('.place-detail-img')).toHaveAttribute('src', urls[1]);
  });

  it('같은 장소의 다른 등록이 있으면 방문 정보에 「복합공간」과 그 등록으로 가는 칩을 둔다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, samePlace: [{ id: '29692', contentTypeId: '38' }] });
    renderAt('/attractions/100');
    const region = await openInfoTab('방문 정보');

    expect(within(region).getByText('복합공간')).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: '같은 장소의 쇼핑 정보' })).toHaveAttribute('href', '/attractions/29692');
  });

  it('주소는 제목 아래가 아니라 방문 정보 첫 줄이다 — 지역 안 위치와 같은 판에 둔다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, address: '서울특별시 종로구 사직로 161' });
    renderAt('/attractions/100');
    const visit = await openInfoTab('방문 정보');

    expect(visit.querySelector('.place-info-addr')?.textContent).toBe('서울특별시 종로구 사직로 161');
    expect(within(visit).getByText('종로구 관광지 40곳 중 고궁 7곳')).toBeInTheDocument();
    expect(screen.getAllByText('서울특별시 종로구 사직로 161')).toHaveLength(1);
  });

  it('지역 문구와 시군구 허브 링크를 그리고, 같은 분류 가까운 곳은 주변 탐색 줄에 표시로 남긴다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    const region = await openInfoTab('방문 정보');

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
    const similar = await screen.findByRole('region', { name: '다른 지역의 비슷한 곳' });

    const links = within(similar).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['경기전전북특별자치도', '화성행궁']);
    expect(links[0]).toHaveAttribute('href', '/attractions/501');
  });

  it('좁은 화면 목록은 처음 8줄과 「목록 더 보기」, 넓은 화면은 전부다', async () => {
    // 편의시설은 종류당 6곳까지라 음식 6 · 쇼핑 6 으로 12곳
    const many = Array.from({ length: 12 }, (_, i) => card(String(600 + i), i < 6 ? 'food' : 'shopping'));
    nearbyFrom((c) =>
      c.includes('food') ? many : [],
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

  it('줄에 마우스를 올려도 목록은 움직이지 않는다 — 넘기면 커서 아래 줄이 바뀌어 목록이 계속 흘렀다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    nearbyFrom((c) => (c.includes('history') ? Array.from({ length: 8 }, (_, i) => card(String(600 + i))) : []));
    // 넓은 화면 목록은 칸 안에서 스크롤된다 — jsdom 은 크기를 재지 않으므로 넘칠 만큼 크다고 둔다
    const sh = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
    const ch = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);
    const scrollTo = vi.fn();
    (HTMLElement.prototype as unknown as { scrollTo: unknown }).scrollTo = scrollTo;
    wide = true;
    try {
      renderAt('/attractions/100');
      const explore = await screen.findByRole('region', { name: '주변 탐색' });
      const row = (await within(explore).findByText('명소 605')).closest('li')!;
      fireEvent.mouseEnter(row);
      expect(row.getAttribute('data-active')).toBe('true');
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      wide = false;
      sh.mockRestore();
      ch.mockRestore();
      delete (HTMLElement.prototype as unknown as { scrollTo?: unknown }).scrollTo;
    }
  });

  it('노출 섹션 번호는 출처 목록 그대로다 — 같은 분류 0 · 비슷한 곳 1 · 주변 명소 2 · 편의시설 3', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    const rows: Array<[string, string]> = [
      ['주변 탐색', '경희궁'], ['주변 탐색', '명소 201'], ['다른 지역의 비슷한 곳', '경기전'], ['주변 탐색', '명소 301'], ['주변 탐색', '명소 401'],
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
    nearbyFrom((c) =>
      c.includes('history')
          ? [card('100'), card('201'), card('301'), card('302')]
          : c.includes('food')
            ? [card('100', 'food'), card('301', 'food'), card('401', 'food')]
            : [],
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

  it('주변은 관광지 id 로 한 번만 부르고, 위치 검색을 직접 부르지 않는다 — 엣지가 id 로 캐시한다(ADR-0105)', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    await screen.findByText('명소 401');

    expect(fetchAttractionNearby).toHaveBeenCalledTimes(1);
    expect(fetchAttractionNearby).toHaveBeenCalledWith('100');
    expect(searchAttractions).not.toHaveBeenCalled();
  });

  it('영문 화면은 영문 제목·문구를 쓴다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({
      ...enriched,
      lang: 'en',
      contentTypeId: '76',
      region: { ...enriched.region!, sigunguName: 'Jongno-gu', categoryName: 'Palaces' },
    });
    renderAt('/en/attractions/100');
    const region = await openInfoTab('At a glance');

    expect(within(region).getByText('Palaces 7 of 40 attractions in Jongno-gu')).toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Explore Jongno-gu' })).toBeInTheDocument();
    expect(summaryRows()).toContainEqual(['Closed', 'Closed on Tuesdays']);
    expect(await screen.findByRole('region', { name: 'Explore nearby' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Similar places in other regions' })).toBeInTheDocument();
  });

  it('유형 코드가 없으면 지역 문구를 짐작하지 않는다 — 허브 링크만 둔다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, contentTypeId: undefined });
    renderAt('/attractions/100');
    const region = await openInfoTab('방문 정보');

    expect(within(region).queryByText(/곳 중/)).toBeNull();
    expect(within(region).getByRole('link', { name: '종로구 둘러보기' })).toBeInTheDocument();
  });

  it('속성·지역이 없는 옛 문서는 새 섹션을 하나도 그리지 않고 주변 탐색은 그대로다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...card('100'), title: '옛 문서', overview: '개요' });
    renderAt('/attractions/100');
    await screen.findByText('명소 201');

    expect(document.querySelector('.place-info-tabs')).toBeNull();
    expect(screen.queryByRole('region', { name: '다른 지역의 비슷한 곳' })).toBeNull();
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
    nearbyFrom(() => []);
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
    expect(screen.queryByRole('region', { name: '다른 지역의 비슷한 곳' })).toBeNull();
  });
});

describe('AttractionPage 근처 행사 · 근처 숙소', () => {
  const NOW = new Date('2026-10-26T03:00:00Z');
  const ev = (id: string, start: string, end: string, km = 3): Attraction => ({
    ...card(id, 'festival'), title: `행사 ${id}`, contentTypeId: '15', eventStart: start, eventEnd: end, distanceKm: km,
  });
  const st = (id: string, km = 1): Attraction => ({ ...card(id, 'stay'), title: `숙소 ${id}`, contentTypeId: '32', distanceKm: km });

  /** 분류별 응답 — 서버가 묶음마다 그 분류만 찾는다 */
  function respond(byCategory: Record<string, Attraction[]>) {
    nearbyFrom((c) => c.split(',').flatMap((x) => byCategory[x] ?? []));
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('근처 행사 — 자기 자신을 빼고 최대 6건을 거리·기간과 그린다(찾는 조건은 서버 몫)', async () => {
    const events = [ev('300', '2026-10-20', '2026-10-30'), ...['601', '602', '603', '604', '605', '606', '607'].map((id, i) => ev(id, `2026-11-0${i + 1}`, `2026-11-0${i + 2}`, 2.5))];
    respond({ festival: events, history: [card('301')] });
    vi.mocked(fetchAttraction).mockResolvedValue({ ...ev('300', '2026-10-20', '2026-10-30'), title: '불꽃축제', overview: '개요' });
    renderAt('/attractions/300');
    const explore = await screen.findByRole('region', { name: '주변 탐색' });
    await within(explore).findByText('행사 601');

    fireEvent.click(within(explore).getByRole('button', { name: /행사 6/ }));
    expect(exploreNames(explore)).toEqual(['행사 601', '행사 602', '행사 603', '행사 604', '행사 605', '행사 606']);
    const first = within(explore).getByText('행사 601').closest('a')!;
    expect(first).toHaveAttribute('href', '/attractions/601');
    expect(within(first).getByText('2.5km')).toBeInTheDocument();
    expect(within(first).getByText('2026-11-01 ~ 2026-11-02')).toBeInTheDocument();
  });

  it('근처 숙소 — 자기 자신을 빼고 최대 6건이다(찾는 조건은 서버 몫)', async () => {
    const stays = [st('310', 0), ...['701', '702', '703', '704', '705', '706', '707'].map((id, i) => st(id, 0.3 + i / 10))];
    respond({ stay: stays });
    vi.mocked(fetchAttraction).mockResolvedValue({ ...st('310', 0), title: '한옥 스테이' });
    renderAt('/attractions/310');
    const explore = await screen.findByRole('region', { name: '주변 탐색' });
    await within(explore).findByText('숙소 701');

    expect(exploreNames(explore)).toEqual(['숙소 701', '숙소 702', '숙소 703', '숙소 704', '숙소 705', '숙소 706']);
    expect(within(within(explore).getByText('숙소 701').closest('a')!).getByText('300m')).toBeInTheDocument();
  });

  it('같은 숙소는 한 화면에 한 번만 뜬다', async () => {
    respond({ food: [card('401', 'food')], shopping: [card('402', 'shopping')], stay: [st('701')] });
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    const explore = await screen.findByRole('region', { name: '주변 탐색' });
    await within(explore).findByText('숙소 701');
    await within(explore).findByText('명소 401');

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
    nearbyFrom(() => []);
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
    await screen.findByRole('tab', { name: '방문 정보' });
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
    nearbyFrom(() => []);
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
    await screen.findByRole('tab', { name: '방문 정보' });
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
    nearbyFrom(() => []);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(fetchWeather).mockResolvedValue({ sigunguCode: '11110', shortBaseAt: null, midTmFc: null, days: [] });
  });

  it('오늘부터 막대로 그리고(어제는 그리지 않는다), 높이는 집중률 그대로 · 오늘 단계와 가장 붐비는 날을 말로 · 안내와 출처를 단다', async () => {
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

    const bars = Array.from(section.querySelectorAll('.place-congestion-day'));
    expect(bars).toHaveLength(2);
    expect(bars[0].getAttribute('aria-current')).toBe('date');
    expect(bars[0].getAttribute('aria-label')).toMatch(/^오늘 \d+월 \d+일 \(.\) — 붐빔 \(집중률 84\.2\)$/);
    expect(bars[1].getAttribute('aria-label')).toContain('매우 붐빔 (집중률 98.1)');
    expect((bars[1].querySelector('.place-congestion-fill') as HTMLElement).style.height).toBe('98.14%');
    expect(section.textContent).not.toContain('집중률 50');
    expect(section.querySelector('.place-congestion-today')!.textContent).toBe('오늘 예상붐빔집중률 84.2');
    expect(within(section).getByText(/^가장 붐비는 날 \d+월 \d+일 \(.\) · 매우 붐빔$/)).toBeInTheDocument();
    expect(within(section).getByText(/네 단계로 나눴습니다/)).toBeInTheDocument();
    expect(within(section).getByText('출처: 한국관광공사 빅데이터 서비스(관광지 집중률 예측)')).toBeInTheDocument();

    // 좁은 화면은 한 줄 요약 + ⓘ — 누르면 기준 설명이 열린다(설명은 닫혀 있어도 DOM 에 있다)
    const info = within(section).getByRole('button', { name: '혼잡도 기준 보기' });
    const detail = within(section).getByText(/네 단계로 나눴습니다/);
    expect(info.getAttribute('aria-controls')).toBe(detail.id);
    expect(info.getAttribute('aria-expanded')).toBe('false');
    expect(detail.hasAttribute('data-open')).toBe(false);
    fireEvent.click(info);
    expect(info.getAttribute('aria-expanded')).toBe('true');
    expect(detail.hasAttribute('data-open')).toBe(true);
  });

  it('단계 경계 — 40 미만 한산 · 40 보통 · 70 붐빔 · 90 매우 붐빔, 이번 주 가장 한산한 날을 알린다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({
      ...enriched,
      congestion: [
        { date: today, rate: 40 },
        { date: plus(1), rate: 39.9 },
        { date: plus(2), rate: 70 },
        { date: plus(3), rate: 90 },
      ],
    });
    renderAt('/attractions/100');
    const section = await screen.findByRole('region', { name: '혼잡 예측' });
    expect(Array.from(section.querySelectorAll('.place-congestion-day')).map((b) => b.getAttribute('data-level'))).toEqual([
      'normal', 'calm', 'busy', 'packed',
    ]);
    expect(within(section).getByText(/^이번 주 가장 한산한 날 \d+월 \d+일 \(.\) · 한산$/)).toBeInTheDocument();
  });

  it('날씨와 함께 있으면 탭으로 묶이고, 혼잡도 탭을 눌러야 보인다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, congestion: [{ date: today, rate: 50 }] });
    vi.mocked(fetchWeather).mockResolvedValue({
      sigunguCode: '11110', shortBaseAt: `${today}T05:00`, midTmFc: null,
      days: [{ date: today, source: 'SHORT', min: 10, max: 20, am: { sky: '맑음', pop: 0 }, pm: { sky: '맑음', pop: 0 }, allDay: null }],
    });
    renderAt('/attractions/100');
    const tabs = await screen.findByRole('region', { name: '날씨 · 대기질 · 혼잡' });
    // 날씨는 관광지보다 늦게 올 수 있다 — 탭은 그릴 것이 생기는 대로 붙는다
    await within(tabs).findByRole('tab', { name: '날씨' });
    expect(within(tabs).getAllByRole('tab').map((t) => t.textContent)).toEqual(['날씨', '혼잡도']);
    expect(within(tabs).getByRole('region', { name: '종로구 날씨' })).toBeInTheDocument();
    expect(within(tabs).queryByRole('region', { name: '혼잡 예측' })).toBeNull();
    fireEvent.click(within(tabs).getByRole('tab', { name: '혼잡도' }));
    expect(within(tabs).getByRole('region', { name: '혼잡 예측' })).toBeInTheDocument();
    expect(within(tabs).queryByRole('region', { name: '종로구 날씨' })).toBeNull();
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
    nearbyFrom(() => []);
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
    const similar = await screen.findByRole('region', { name: '다른 지역의 비슷한 곳' });
    expect(within(similar).getByText('광안리해수욕장')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '다른 지역의 비슷한 곳' })).toHaveAttribute('aria-selected', 'true');

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

describe('AttractionPage 계측 — 지도 열기 · 찜 배선', () => {
  beforeEach(() => nearbyFrom(() => []));
  afterEach(() => vi.clearAllMocks());

  it('구글 지도 링크 클릭 → CLICK MAP_LINK(ATTRACTION_DETAIL · screenRef 는 관광지 id), 기본 동작은 그대로', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    const link = await screen.findByRole('link', { name: '구글 지도에서 보기' });
    vi.mocked(track).mockClear();

    expect(fireEvent.click(link)).toBe(true);
    const clicks = vi.mocked(track).mock.calls.filter(([action]) => action === 'CLICK');
    expect(clicks).toHaveLength(1);
    expect(clicks[0][1]).toEqual({
      entityType: 'ATTRACTION', entityId: '100', screenType: 'ATTRACTION_DETAIL', screenRef: '100',
      sectionId: 'MAP_LINK', payload: { kind: 'google_maps_search' },
    });
  });

  it('찜 버튼은 이 화면의 viewId 와 screenRef(관광지 id)를 받는다 — 지도 링크 CLICK 과 같은 view', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    fireEvent.click(await screen.findByRole('link', { name: '구글 지도에서 보기' }));
    const mapClick = vi.mocked(track).mock.calls.find(([action, item]) => action === 'CLICK' && item.sectionId === 'MAP_LINK')!;

    const fav = screen.getByTestId('fav');
    expect(fav.dataset.key).toBe('100');
    expect(fav.dataset.ref).toBe('100');
    expect(fav.dataset.view).toBe(mapClick[2]);
  });
});

describe('AttractionPage 계측 — 길찾기 · 공유', () => {
  beforeEach(() => {
    nearbyFrom(() => []);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });
  afterEach(() => vi.clearAllMocks());

  const clicks = () => vi.mocked(track).mock.calls.filter(([action]) => action === 'CLICK');

  it('행동 줄의 길찾기는 구글맵 경로 링크이고, 누르면 CLICK DIRECTIONS 하나 — 지도 링크는 MAP_LINK 그대로', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, address: '서울특별시 종로구 사직로 161' });
    renderAt('/attractions/100');
    const actions = (await screen.findByRole('link', { name: '길찾기' })).closest('[data-place-section="actions"]') as HTMLElement;
    const directions = within(actions).getByRole('link', { name: '길찾기' });
    expect(directions).toHaveAttribute(
      'href',
      googleMapsDirectionsUrl({ name: '경복궁', latitude: 37.5, longitude: 127, roadAddress: '서울특별시 종로구 사직로 161' }),
    );
    // 좌표로 도착지를 정한다 — 이름 검색은 같은 이름의 다른 곳으로 안내할 수 있다
    expect(directions.getAttribute('href')).toContain('https://www.google.com/maps/dir/?api=1');
    expect(directions.getAttribute('href')).toContain('destination=37.5,127');
    vi.mocked(track).mockClear();

    expect(fireEvent.click(directions)).toBe(true);
    expect(clicks()).toHaveLength(1);
    expect(clicks()[0][1]).toEqual({
      entityType: 'ATTRACTION', entityId: '100', screenType: 'ATTRACTION_DETAIL', screenRef: '100',
      sectionId: 'DIRECTIONS', payload: { kind: 'google_maps_directions' },
    });

    fireEvent.click(within(actions).getByRole('link', { name: '구글 지도에서 보기' }));
    expect(clicks()[1][1]).toMatchObject({ sectionId: 'MAP_LINK', payload: { kind: 'google_maps_search' } });
  });

  it('공유 막대의 복사·Web Share·X·LinkedIn 은 채널마다 CLICK SHARE(ATTRACTION · 관광지 id · ATTRACTION_DETAIL)', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    const panel = await screen.findByRole('group', { name: '공유' });
    vi.mocked(track).mockClear();

    fireEvent.click(within(panel).getByRole('button', { name: '링크 복사' }));
    fireEvent.click(within(panel).getByRole('button', { name: '공유' }));
    fireEvent.click(within(panel).getByRole('link', { name: /^X/ }));
    fireEvent.click(within(panel).getByRole('link', { name: /^LinkedIn/ }));

    const shares = clicks();
    expect(shares.map(([, item]) => item)).toEqual(
      (['copy', 'share', 'x', 'linkedin'] as const).map((channel) => ({
        entityType: 'ATTRACTION', entityId: '100', screenType: 'ATTRACTION_DETAIL', screenRef: '100',
        sectionId: 'SHARE', payload: { kind: 'attraction', channel },
      })),
    );
    // 찜·지도 링크와 같은 화면 view 다
    expect(new Set(shares.map(([, , viewId]) => viewId)).size).toBe(1);
    expect(screen.getByTestId('fav').dataset.view).toBe(shares[0][2]);
  });
});

/** 로그인 복귀 — 상세는 주소가 곧 상태라 찜 의도만 이어 받는다 */
describe('AttractionPage 로그인 복귀', () => {
  const INTENT_KEY = 'kgd.favoriteIntent.v1';
  const setSession = (memberId: string | null) => {
    document.cookie = memberId ? `portal_user_id=${memberId}; Path=/` : 'portal_user_id=; Path=/; Max-Age=0';
  };
  const seedIntent = () =>
    sessionStorage.setItem(INTENT_KEY, JSON.stringify({ targetType: 'ATTRACTION', targetKey: '100', createdAt: Date.now() }));
  const favoriteClicks = () =>
    vi.mocked(track).mock.calls.filter(([a, e]) => a === 'CLICK' && e.sectionId === 'FAVORITE').map(([, e]) => e);

  beforeEach(() => {
    nearbyFrom(() => []);
    sessionStorage.clear();
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    vi.mocked(fetchFavoriteKeys).mockResolvedValue([]);
    vi.mocked(addFavorite).mockResolvedValue({
      id: 1, targetType: 'ATTRACTION', targetKey: '100', collectionId: null, createdAt: '2026-10-09T00:00:00Z',
    });
  });
  afterEach(() => {
    setSession(null);
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('로그인 마운트 + 유효 의도 → PUT 1회 · 「찜했습니다」 · resumed 계측 1건', async () => {
    setSession('1');
    seedIntent();
    renderAt('/attractions/100');

    expect(await screen.findByText('찜했습니다')).toHaveAttribute('role', 'status');
    expect(addFavorite).toHaveBeenCalledTimes(1);
    expect(addFavorite).toHaveBeenCalledWith('ATTRACTION', '100');
    expect(sessionStorage.getItem(INTENT_KEY)).toBeNull();
    expect(favoriteClicks()).toHaveLength(1);
    expect(favoriteClicks()[0]).toMatchObject({
      entityType: 'ATTRACTION', entityId: '100', screenType: 'ATTRACTION_DETAIL', screenRef: '100',
      payload: { saved: true, resumed: true },
    });
  });

  it('비로그인 마운트 → 의도를 소비하지도 지우지도 않는다', async () => {
    seedIntent();
    renderAt('/attractions/100');
    await screen.findByRole('link', { name: '구글 지도에서 보기' });

    expect(sessionStorage.getItem(INTENT_KEY)).not.toBeNull();
    expect(fetchFavoriteKeys).not.toHaveBeenCalled();
    expect(addFavorite).not.toHaveBeenCalled();
  });
});

describe('AttractionPage 사진 주소 https', () => {
  const TONG = 'http://tong.visitkorea.or.kr/cms/resource/';
  const photos = [0, 1, 2].map((i) => `${TONG}${i}.jpg`);

  beforeEach(() => {
    // 주변 탐색 썸네일도 http 원천으로 온다
    nearbyFrom((c) => (c.includes('history') ? [{ ...card('301'), imageUrl: `${TONG}301.jpg` }] : []));
    vi.mocked(fetchAttraction).mockResolvedValue({
      ...enriched,
      imageUrl: photos[0],
      // 대표 사진이 원문에 https 로 한 번 더 들어 있다 — 중복 판정은 프로토콜을 빼고 한다
      imagesRaw: JSON.stringify([
        { originimgurl: photos[0].replace('http:', 'https:'), imgname: '대표' },
        ...photos.slice(1).map((u, i) => ({ originimgurl: u, imgname: `사진${i + 1}` })),
      ]),
    });
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const httpTong = () =>
    document.querySelectorAll('img[src^="http://tong."], [data-src^="http://tong."]').length;

  it('큰 사진·타일·크게 보기·주변 탐색·og:image·JSON-LD 가 https 이고 중복 사진은 한 장', async () => {
    renderAt('/attractions/100');
    const tiles = await screen.findByRole('group', { name: '사진' });
    await screen.findByText('명소 301');

    expect(document.querySelectorAll('img[src^="https://tong."]').length).toBeGreaterThanOrEqual(4);
    expect(httpTong()).toBe(0);
    expect(within(tiles).getAllByRole('button')).toHaveLength(2);
    const hero = document.querySelector<HTMLElement>('.place-detail-hero')!;
    expect(hero.style.backgroundImage).toContain('https://tong.');
    expect(hero.style.backgroundImage).not.toContain('http://tong.');

    expect(document.head.querySelector('meta[property="og:image"]')).toHaveAttribute('content', `https://tong.visitkorea.or.kr/cms/resource/0.jpg`);
    const ld = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent ?? '');
    expect(ld.some((t) => t.includes('https://tong.visitkorea.or.kr/cms/resource/0.jpg'))).toBe(true);
    expect(ld.some((t) => t.includes('http://tong.'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: '사진 크게 보기' }));
    const viewer = screen.getByRole('dialog', { name: '사진 크게 보기' });
    expect(viewer.querySelector('.place-photo-viewer-img')!.getAttribute('src')).toMatch(/^https:\/\/tong\./);
    expect(httpTong()).toBe(0);
  });
});

/** 첫 화면 — 브레드크럼(시군구) → 제목 → 방문 요약 → 배지 줄 → 행동 줄 → 개요 → 사진. 서버 렌더와 같은 순서다 */
describe('AttractionPage 첫 화면 — 방문 요약 · 행동 줄', () => {
  beforeEach(() => nearbyFrom(() => []));
  afterEach(() => vi.clearAllMocks());

  const first: Attraction = {
    ...enriched,
    sidoName: '서울특별시',
    imageUrl: 'https://img.example/hero.jpg',
    feeText: '어른 3,000원',
    infoCenter: '경복궁 관리소 02-3700-3900',
    uniqueClickers14d: 5,
  };
  const at = (selector: string) => {
    const el = document.querySelector(selector);
    expect(el, selector).not.toBeNull();
    return el!;
  };
  const isBefore = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  const actions = () => at('[data-place-section="actions"]') as HTMLElement;

  it('일반 유형 — 브레드크럼(시도 › 시군구) → 제목·찜 → 방문 요약 → 배지 줄 → 행동 줄(길찾기·전화) → 개요 → 사진 히어로', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(first);
    renderAt('/attractions/100');
    await screen.findByRole('heading', { level: 1, name: '경복궁' });

    const nav = screen.getByRole('navigation', { name: '탐색 경로' });
    expect(within(nav).getByRole('link', { name: '서울특별시' })).toHaveAttribute('href', '/regions/11');
    expect(within(nav).getByRole('link', { name: '종로구' })).toHaveAttribute('href', '/regions/11110');
    const order = [
      within(nav).getByRole('link', { name: '종로구' }),
      screen.getByRole('heading', { level: 1 }),
      screen.getByTestId('fav'),
      at('[data-place-section="visit-summary"]'),
      at('[data-place-section="visit-badges"]'),
      actions(),
      screen.getByText('조선의 법궁이다.'),
      at('.place-detail-hero'),
    ];
    order.slice(1).forEach((el, i) => expect(isBefore(order[i], el), `${i} → ${i + 1}`).toBe(true));
    expect(within(actions()).getByRole('link', { name: '구글 지도에서 보기' })).toBeInTheDocument();
    expect(within(actions()).getByRole('link', { name: '경복궁 관리소 02-3700-3900' })).toHaveAttribute('href', 'tel:0237003900');
    // 길찾기는 요약 아래로 옮겼다 — 한 번만 있다
    expect(screen.getAllByRole('link', { name: '구글 지도에서 보기' })).toHaveLength(1);
  });

  it('시군구 코드가 없으면 브레드크럼은 시도까지다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...first, region: { ...first.region!, ldongSignguCd: null } });
    renderAt('/attractions/100');
    const nav = await screen.findByRole('navigation', { name: '탐색 경로' });
    await screen.findByRole('heading', { level: 1 });

    expect(within(nav).getByRole('link', { name: '서울특별시' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: '종로구' })).toBeNull();
  });

  it('방문 요약은 일곱 칸을 표 순서로 — 값이 없는 칸은 「정보 없음」', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(first);
    renderAt('/attractions/100');
    await screen.findByRole('heading', { level: 1 });

    expect(summaryRows()).toEqual([
      ['요금', '어른 3,000원'],
      ['이용시간', '09:00~18:00'],
      ['쉬는 날', '매주 화요일 휴무'],
      ['주차', '주차 가능'],
      ['반려동물', '정보 없음'],
      ['무장애', '정보 없음'],
      ['확인 상태', '출처: 정보 없음 · 원천 갱신일: 정보 없음 · 수집일: 정보 없음'],
    ]);
    expect(badgeLine()).toBe('유모차 대여 없음 · 많이 클릭한 곳');
  });

  it('배지 줄은 항목이 없으면 그리지 않는다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...first, attrStrollerRental: 'UNKNOWN', uniqueClickers14d: 0 });
    renderAt('/attractions/100');
    await screen.findByRole('heading', { level: 1 });

    expect(document.querySelector('[data-place-section="visit-summary"]')).not.toBeNull();
    expect(document.querySelector('[data-place-section="visit-badges"]')).toBeNull();
  });

  it('「이용 안내」(일반 유형) — 요약과 겹치는 다섯 행은 빼고 주차요금·intro·반복정보(요금 행 포함)는 원천 순서대로 남긴다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({
      ...first,
      useTime: '09:00~18:00',
      restDate: '매주 화요일',
      useFee: '어른 3,000원',
      parking: '가능',
      parkingFee: '소형 2,000원',
      introRaw: JSON.stringify({ expguide: '수문장 교대식', usetime: '09:00~18:00' }),
      infoRaw: JSON.stringify([
        { serialnum: '1', infoname: '입장료', infotext: '어른 3,000원' },
        { serialnum: '0', infoname: '화장실', infotext: '있음' },
      ]),
    });
    renderAt('/attractions/100');
    const info = await screen.findByRole('region', { name: '이용 안내' });

    const rows = Array.from(info.querySelectorAll('.place-detail-info-row')).map((r) => [
      r.querySelector('dt')!.textContent, r.querySelector('dd')!.textContent,
    ]);
    expect(rows).toEqual([
      ['주차요금', '소형 2,000원'],
      ['체험 안내', '수문장 교대식'],
      ['화장실', '있음'],
      ['입장료', '어른 3,000원'],
    ]);
  });

  it('행사·숙박·코스는 방문 요약·배지 줄이 없고 정보 탭 배지는 그대로, 행동 줄은 붙는다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({
      ...card('310', 'stay'),
      title: '한옥 스테이',
      contentTypeId: '32',
      introRaw: JSON.stringify({ checkintime: '15:00' }),
      attrParking: 'YES',
      tel: '02-555-1234',
    });
    renderAt('/attractions/310');
    const tab = await screen.findByRole('tabpanel', { name: '방문 정보' });

    expect(document.querySelector('[data-place-section="visit-summary"]')).toBeNull();
    expect(document.querySelector('[data-place-section="visit-badges"]')).toBeNull();
    expect(within(tab).getByText('주차 가능')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '숙박 정보' })).toBeInTheDocument();
    expect(within(actions()).getByRole('link', { name: '구글 지도에서 보기' })).toBeInTheDocument();
    expect(within(actions()).getByRole('link', { name: '02-555-1234' })).toHaveAttribute('href', 'tel:025551234');
  });

  it('문의(infoCenter)가 비면 제목 아래 전화 줄 없이 행동 줄이 tel 을 쓴다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...first, infoCenter: '', tel: '02-123-4567' });
    renderAt('/attractions/100');
    await screen.findByRole('heading', { level: 1 });

    expect(document.querySelector('.place-detail-tel')).toBeNull();
    expect(within(actions()).getByRole('link', { name: '02-123-4567' })).toHaveAttribute('href', 'tel:021234567');
    expect(screen.getAllByText('02-123-4567')).toHaveLength(1);
  });

  it('문의와 tel 이 둘 다 있으면 둘 다 보인다 — 행동 줄은 문의, 제목 아래 줄은 tel', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...first, tel: '02-123-4567' });
    renderAt('/attractions/100');
    await screen.findByRole('heading', { level: 1 });

    expect(at('.place-detail-tel')).toHaveTextContent('02-123-4567');
    expect(within(actions()).getByRole('link', { name: '경복궁 관리소 02-3700-3900' })).toHaveAttribute('href', 'tel:0237003900');
  });

  it('번호 모양이 없는 원문은 링크 없이 글로만, 원문이 비면 전화 항목이 없다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...first, infoCenter: '문의: 없음' });
    const { unmount } = renderAt('/attractions/100');
    await screen.findByRole('heading', { level: 1 });
    expect(within(actions()).getByText('문의: 없음')).toBeInTheDocument();
    expect(within(actions()).getAllByRole('link').map((a) => a.textContent)).toEqual(['구글 지도에서 보기', '길찾기']);
    unmount();

    vi.mocked(fetchAttraction).mockResolvedValue({ ...first, infoCenter: null, tel: null });
    renderAt('/attractions/100');
    await screen.findByRole('heading', { level: 1 });
    expect(actions().querySelector('a[href^="tel:"]')).toBeNull();
  });

  it('XSS — 요금 원문의 태그 모양 글자는 글로만 보이고 방문 요약 안에 img 요소가 생기지 않는다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...first, feeText: '<img src=x onerror=alert(1)> "무료"' });
    renderAt('/attractions/100');
    await screen.findByRole('heading', { level: 1 });

    const summary = at('[data-place-section="visit-summary"]');
    expect(summary.querySelectorAll('img')).toHaveLength(0);
    expect(summaryRows()[0]).toEqual(['요금', '<img src=x onerror=alert(1)> "무료"']);
  });

  it('영문 화면 — Admission · Closed 칸과 Open in Google Maps 행동 줄', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...first, lang: 'en', contentTypeId: '76' });
    renderAt('/en/attractions/100');
    await screen.findByRole('heading', { level: 1 });

    expect(summaryRows().map(([label]) => label)).toEqual(['Admission', 'Hours', 'Closed', 'Parking', 'Pets', 'Accessibility', 'Data status']);
    expect(within(actions()).getByRole('link', { name: 'Open in Google Maps' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });
});

describe('AttractionPage hreflang — 언어 대체 짝', () => {
  beforeEach(() => nearbyFrom(() => []));
  afterEach(() => {
    vi.clearAllMocks();
    document.head.innerHTML = '';
  });

  const hreflangs = () =>
    Array.from(document.head.querySelectorAll('link[rel="alternate"][hreflang]')).map((l) => [
      l.getAttribute('hreflang'), l.getAttribute('href'), l.hasAttribute('data-seo-multi'),
    ]);
  const PAIR = [
    ['ko', 'https://place.1989v.com/attractions/100', true],
    ['en', 'https://place.1989v.com/en/attractions/E100', true],
    ['x-default', 'https://place.1989v.com/en/attractions/E100', true],
  ];

  it('짝이 있고 색인 대상이면 ko · en · x-default 세 줄을 단다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, alternateId: 'E100' });
    renderAt('/attractions/100');
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    expect(hreflangs()).toEqual(PAIR);
  });

  it('어긋난 주소(/en/attractions/{국문 id})로 와도 문서 언어 기준으로 같은 세 줄이다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, alternateId: 'E100' });
    renderAt('/en/attractions/100');
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    expect(hreflangs()).toEqual(PAIR);
  });

  it('짝이 없으면 hreflang 을 달지 않는다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, alternateId: null });
    renderAt('/attractions/100');
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    expect(document.head.querySelector('link[rel="canonical"]')).not.toBeNull();
    expect(hreflangs()).toEqual([]);
  });

  it('짝이 있어도 개요가 없어 noindex 면 달지 않는다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...enriched, overview: null, alternateId: 'E100' });
    renderAt('/attractions/100');
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    expect(hreflangs()).toEqual([]);
  });
});

describe('AttractionPage 피드 링크', () => {
  beforeEach(() => nearbyFrom(() => []));
  afterEach(() => {
    vi.clearAllMocks();
    document.head.innerHTML = '';
  });

  const feeds = () =>
    Array.from(document.head.querySelectorAll('link[rel="alternate"][type="application/rss+xml"]')).map((l) => [
      l.getAttribute('href'), l.hasAttribute('data-seo-multi'),
    ]);

  it('국문 상세는 국문 피드 링크 하나를 단다(서버 렌더와 같은 값)', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue(enriched);
    renderAt('/attractions/100');
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    expect(feeds()).toEqual([['https://place.1989v.com/feed.xml', true]]);
  });
});
