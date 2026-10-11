import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdministrativeRegion, Attraction, AttractionQuery, AttributeFacets } from '../../../api/placeApi';

vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  searchAttractions: vi.fn(),
  fetchAdministrativeRegions: vi.fn(),
  fetchAttraction: vi.fn(),
  suggestPlaces: vi.fn(),
}));
// 찜 대역은 계측 배선(`tracking`)만 드러낸다 — 어느 view·어느 지역 코드를 받았는지 본다
vi.mock('../../../components/favorite/FavoriteButton', () => ({
  default: ({ targetKey, tracking }: { targetKey: string; tracking?: { viewId: string; screenRef?: string } }) => (
    <button data-testid="fav" data-key={targetKey} data-view={tracking?.viewId} data-ref={tracking?.screenRef} />
  ),
}));
vi.mock('../../../analytics/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../analytics/tracker')>()),
  track: vi.fn(),
}));

import { fetchAdministrativeRegions, fetchAttraction, searchAttractions, suggestPlaces } from '../../../api/placeApi';
import { track } from '../../../analytics/tracker';
import { DWELL_MS } from '../../../analytics/useImpression';
import { advance, installIntersectionObserver } from '../../../components/ads/__tests__/adsTestKit';
import PlacePage, { resetPlaceSessionForTest } from '../PlacePage';

const facets = (over: Partial<AttributeFacets> = {}): AttributeFacets => ({
  openToday: 120,
  parking: { YES: 80 },
  creditCard: { YES: 0 },
  strollerRental: { YES: 3 },
  pet: { ALLOWED: 5, PARTIAL: 0 },
  admission: { FREE: 1234 },
  barrierFree: { WHEELCHAIR: 18, ELEVATOR: 0, RESTROOM: 57 },
  wellness: 168,
  ...over,
});

const item = (id: string): Attraction => ({
  id, contentId: id, lang: 'ko', title: `관광지 ${id}`, category: 'nature', areaCode: null,
  address: null, latitude: 37.5, longitude: 127, imageUrl: null, tel: null, overview: null,
  distanceKm: null, position: 0,
});

/** 요청 조건에 따라 응답을 만든다 — 쪽마다 다른 id, 속성 필터가 걸리면 다른 id 대역. */
function respond(q: AttractionQuery, facetsFor: (q: AttractionQuery) => AttributeFacets | null) {
  const page = q.page ?? 0;
  const prefix = q.parking ? 'p' : 'a';
  return Promise.resolve({
    searchId: 's',
    attractions: [item(`${prefix}${page}-1`), item(`${prefix}${page}-2`)],
    totalElements: 6,
    totalPages: 3,
    currentPage: page,
    // 서버 계약: facets=true 일 때만 싣는다
    attributeFacets: q.facets ? facetsFor(q) : null,
  });
}

let mobile = false;
function stubMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: mobile,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderPage(path = '/place') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <PlacePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const calls = () => vi.mocked(searchAttractions).mock.calls.map(([q]) => q);
/**
 * 「필터」 시트 — 두 폭 모두 분류 전부·행사 상태·속성·지도 오버레이 칩은 이 안에 있다(넓은 화면은 다이얼로그).
 * 열려 있으면 그대로 돌려준다. 시트 밖 버튼을 누르기 전에는 closeFilters 로 닫는다(실제 흐름과 같게).
 */
const openFilters = () => {
  const open = screen.queryByRole('dialog', { name: /^(필터|Filters)$/ });
  if (open) return open;
  fireEvent.click(screen.getByRole('button', { name: /^(필터|Filters)/ }));
  return screen.getByRole('dialog', { name: /^(필터|Filters)$/ });
};
const closeFilters = () => fireEvent.keyDown(document, { key: 'Escape' });
const chip = (label: RegExp) => within(openFilters()).getByRole('button', { name: label });
const chipLabels = () =>
  Array.from(openFilters().querySelectorAll('.place-attr-chip')).map((el) => el.getAttribute('data-attr'));

describe('PlacePage 속성 칩', () => {
  beforeEach(() => {
    mobile = false;
    stubMedia();
    vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
    vi.mocked(suggestPlaces).mockResolvedValue([]);
    vi.mocked(searchAttractions).mockReset();
    vi.mocked(searchAttractions).mockImplementation((q) => respond(q, () => facets()));
  });
  afterEach(() => vi.clearAllMocks());

  it('열한 칩(방문 속성 7 · 무장애 3 · 웰니스 1)을 분류 칩과 다른 묶음에 그리고, 첫 쪽 응답의 건수를 붙인다', async () => {
    renderPage();
    await screen.findByText('관광지 a0-1');

    const group = within(openFilters()).getByRole('group', { name: '방문 정보 필터' });
    expect(group.querySelectorAll('.place-attr-chip')).toHaveLength(11);
    expect(group.closest('.place-filters')).toBeNull();
    expect(within(group).getByText('정보가 있는 곳만 거릅니다')).toBeInTheDocument();

    await waitFor(() => expect(chip(/^주차 가능/)).toHaveTextContent('80'));
    expect(chip(/^입장 무료/)).toHaveTextContent('1,234');
    expect(chip(/^오늘 정기휴무일 아님\(명절 제외\)/)).toHaveTextContent('120');
    expect(calls()[0]).toMatchObject({ page: 0, facets: true });
  });

  it('안 고른 칩이 0 이면 흐리게 두고 자리를 지킨다 — 숨기지 않는다', async () => {
    renderPage();
    await waitFor(() => expect(chip(/^신용카드/)).toHaveTextContent('0'));

    expect(chipLabels()).toEqual([
      'openToday', 'parking', 'creditCard', 'strollerRental', 'petAllowed', 'petPartial', 'admissionFree',
      'bfWheelchair', 'bfElevator', 'bfRestroom', 'wellness',
    ]);
    expect(chip(/^신용카드/)).toHaveClass('is-empty');
    expect(chip(/^반려동물 일부 구역/)).toHaveClass('is-empty');
    expect(chip(/^주차 가능/)).not.toHaveClass('is-empty');
  });

  it('고른 칩은 건수가 0 이 되어도 활성이다 — 풀 수 있어야 한다', async () => {
    vi.mocked(searchAttractions).mockImplementation((q) =>
      respond(q, (req) => facets(req.parking ? { parking: { YES: 0 } } : {})),
    );
    renderPage();
    await screen.findByText('관광지 a0-1');

    fireEvent.click(chip(/^주차 가능/));
    await screen.findByText('관광지 p0-1');
    await waitFor(() => expect(chip(/^주차 가능/)).toHaveTextContent('0'));

    expect(chip(/^주차 가능/)).toHaveClass('active');
    expect(chip(/^주차 가능/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^주차 가능/)).not.toHaveClass('is-empty');
  });

  it('칩을 누르면 속성 파라미터를 싣고 첫 쪽을 건수와 함께 다시 받는다', async () => {
    renderPage();
    await screen.findByText('관광지 a0-1');

    fireEvent.click(chip(/^반려동물 동반/));
    fireEvent.click(chip(/^반려동물 일부 구역/));
    await waitFor(() => expect(calls().at(-1)).toMatchObject({ pet: ['ALLOWED', 'PARTIAL'], page: 0, facets: true }));
  });

  it('행사 칩을 고르면 속성 칩 줄을 그리지 않고 속성 조건·건수 요청도 보내지 않는다 — 풀면 고른 칩이 돌아온다', async () => {
    renderPage();
    await screen.findByText('관광지 a0-1');
    fireEvent.click(chip(/^주차 가능/));
    await screen.findByText('관광지 p0-1');

    fireEvent.click(within(openFilters()).getByRole('button', { name: '행사' }));
    await waitFor(() => expect(calls().at(-1)).toMatchObject({ category: 'festival', page: 0 }));
    expect(screen.queryByRole('group', { name: '방문 정보 필터' })).toBeNull();
    expect(document.querySelector('.place-attr-chip')).toBeNull();
    const eventCall = calls().at(-1)!;
    expect(eventCall.facets).toBeFalsy();
    expect(eventCall.parking).toBeUndefined();

    // 풀면 앞의 주차 조건 그대로 — 같은 조건은 캐시에서 나와 새 요청이 없을 수 있어 칩·목록으로 본다
    fireEvent.click(within(openFilters()).getByRole('button', { name: '행사' }));
    expect(await screen.findByRole('group', { name: '방문 정보 필터' })).toBeInTheDocument();
    expect(chip(/^주차 가능/)).toHaveAttribute('aria-pressed', 'true');
    expect(await screen.findByText('관광지 p0-1')).toBeInTheDocument();
  });

  it('다음 쪽은 건수를 요청하지 않고, 앞서 받은 건수를 그대로 보인다', async () => {
    renderPage();
    await screen.findByText('관광지 a0-1');
    await waitFor(() => expect(chip(/^주차 가능/)).toHaveTextContent('80'));

    closeFilters();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await screen.findByText('관광지 a1-1');

    const page1 = calls().find((q) => q.page === 1);
    expect(page1).toBeDefined();
    expect(page1!.facets).toBeFalsy();
    expect(chip(/^주차 가능/)).toHaveTextContent('80');
  });

  it('모바일 누적 목록은 필터가 바뀌면 처음부터 다시 쌓는다', async () => {
    mobile = true;
    stubMedia();
    renderPage();
    await screen.findByText('관광지 a0-1');
    fireEvent.click(screen.getByRole('button', { name: '더 보기' }));
    await screen.findByText('관광지 a1-1');
    expect(screen.getByText('관광지 a0-1')).toBeInTheDocument(); // 누적

    // 좁은 화면의 속성 칩은 「필터」 시트 안에 있다
    fireEvent.click(screen.getByRole('button', { name: '필터' }));
    fireEvent.click(chip(/^주차 가능/));
    await screen.findByText('관광지 p0-1');

    expect(screen.queryByText('관광지 a0-1')).toBeNull();
    expect(screen.queryByText('관광지 a1-1')).toBeNull();
    expect(calls().at(-1)).toMatchObject({ parking: 'YES', page: 0, facets: true });
  });

  it('건수를 못 받으면(null) 숫자 없이 칩만 그린다 — 0 으로 흐리지 않는다', async () => {
    vi.mocked(searchAttractions).mockImplementation((q) => respond(q, () => null));
    renderPage();
    await screen.findByText('관광지 a0-1');
    openFilters();

    expect(document.querySelectorAll('.place-attr-count')).toHaveLength(0);
    expect(document.querySelectorAll('.place-attr-chip.is-empty')).toHaveLength(0);
    expect(document.querySelectorAll('.place-attr-chip')).toHaveLength(11);
  });

  it('영문 화면은 영문 칩·안내 문구를 쓴다', async () => {
    renderPage('/en/place');
    await screen.findByText('관광지 a0-1');

    const group = within(openFilters()).getByRole('group', { name: 'Visitor info filters' });
    expect(within(group).getByRole('button', { name: /^Not a regular closing day today \(holidays excluded\)/ })).toBeInTheDocument();
    // 영문 원천에 반려동물 값이 없다(petAcmpyType 영문 채움 0) — 늘 0 인 칩을 두지 않는다
    expect(within(group).queryByRole('button', { name: /^Pets in some areas/ })).toBeNull();
    expect(within(group).getByText('Filters only places that list this information')).toBeInTheDocument();
    // 무장애 원천은 국문뿐이다 — 영문에서는 늘 0 인 칩을 두지 않는다. 웰니스는 영문 92곳이 있다
    expect(within(group).queryByRole('button', { name: /^Wheelchairs/ })).toBeNull();
    expect(within(group).getByRole('button', { name: /^Wellness tourism/ })).toBeInTheDocument();
  });

  it('영문 칩은 원천 값이 있는 네 종(정기휴무·주차·입장 무료·웰니스), 국문은 열한 종이다', async () => {
    renderPage('/en/place');
    await screen.findByText('관광지 a0-1');
    expect(chipLabels()).toEqual(['openToday', 'parking', 'admissionFree', 'wellness']);
    cleanup();

    renderPage();
    await screen.findByText('관광지 a0-1');
    expect(chipLabels()).toEqual([
      'openToday', 'parking', 'creditCard', 'strollerRental', 'petAllowed', 'petPartial', 'admissionFree',
      'bfWheelchair', 'bfElevator', 'bfRestroom', 'wellness',
    ]);
  });

  it('무장애 칩은 코드 목록(AND)으로, 웰니스 칩은 참으로 요청하고 건수를 붙인다', async () => {
    renderPage();
    await screen.findByText('관광지 a0-1');
    await waitFor(() => expect(chip(/^장애인 화장실/)).toHaveTextContent('57'));
    expect(chip(/^엘리베이터/)).toHaveClass('is-empty');
    expect(chip(/^웰니스 관광/)).toHaveTextContent('168');

    fireEvent.click(chip(/^휠체어/));
    fireEvent.click(chip(/^장애인 화장실/));
    fireEvent.click(chip(/^웰니스 관광/));

    await waitFor(() =>
      expect(calls().at(-1)).toMatchObject({ barrierFree: ['WHEELCHAIR', 'RESTROOM'], wellness: true, page: 0, facets: true }),
    );
  });
});

/*
 * 개요 정규화는 값 하나에 한 번, 원문을 받는 곳에서만 — 패널은 단건 조회 원문이라 화면이 정리하고,
 * 카드는 서버가 이미 정리한 목록 요약이라 그대로 그린다. 판정은 그려진 DOM 텍스트다.
 */
describe('PlacePage 개요 표시', () => {
  beforeEach(() => {
    mobile = false;
    stubMedia();
    vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
    vi.mocked(suggestPlaces).mockResolvedValue([]);
    vi.mocked(searchAttractions).mockReset();
  });
  afterEach(() => vi.clearAllMocks());

  const listWith = (overview: string | null) =>
    vi.mocked(searchAttractions).mockResolvedValue({
      searchId: 's', attractions: [{ ...item('o1'), overview }], totalElements: 1, totalPages: 1, currentPage: 0,
    });
  const openPanel = async () => {
    fireEvent.click(await screen.findByText('관광지 o1'));
    return screen.findByRole('complementary', { name: '관광지 o1' });
  };

  it('패널은 단건 원문의 엔티티·태그를 정리해 그린다', async () => {
    listWith(null);
    vi.mocked(fetchAttraction).mockResolvedValue({ ...item('o1'), overview: 'It&rsquo;s a palace.<br />Open daily.' });
    renderPage();
    const panel = await openPanel();
    const overview = await waitFor(() => {
      const el = panel.querySelector('.place-detail-overview');
      expect(el).not.toBeNull();
      return el!;
    });
    expect(overview.textContent).toBe('It\u2019s a palace.\nOpen daily.');
    expect(panel.textContent).not.toMatch(/&rsquo;|<br/);
  });

  it('정리하고 나서 비는 개요는 요소를 그리지 않는다', async () => {
    listWith(null);
    vi.mocked(fetchAttraction).mockResolvedValue({ ...item('o1'), overview: '<br /><br />' });
    renderPage();
    const panel = await openPanel();
    await within(panel).findByRole('link', { name: '구글맵에서 보기' });
    expect(panel.querySelector('.place-detail-overview')).toBeNull();
  });

  it('패널 원문 &lt;PARASITE&gt; 는 한 번만 풀려 <PARASITE> 로 보인다', async () => {
    listWith(null);
    vi.mocked(fetchAttraction).mockResolvedValue({ ...item('o1'), overview: 'K-movie &lt;PARASITE&gt; - set' });
    renderPage();
    const panel = await openPanel();
    await waitFor(() => expect(panel.querySelector('.place-detail-overview')?.textContent).toBe('K-movie <PARASITE> - set'));
  });

  it('카드는 서버가 정리한 목록 요약을 다시 정리하지 않는다 — <PARASITE> 가 그대로 남는다', async () => {
    listWith('K-movie <PARASITE> - …');
    renderPage();
    const card = (await screen.findByText('관광지 o1')).closest('a')!;
    expect(card.querySelector('.place-card-overview')?.textContent).toBe('K-movie <PARASITE> - …');
  });
});

/*
 * 허브 결과 카드 — 제목 → 현지명 → meta(분류 · 지역 · 거리 · 찜) → 행사 줄 → 카드 상태 배지 → 개요 1줄.
 * 주소 줄은 뺐다(지역 라벨이 대신한다). 판정은 그려진 DOM 이다. 날짜는 Date 만 고정한다.
 */
describe('PlacePage 허브 카드', () => {
  const card = (over: Partial<Attraction>): Attraction => ({
    ...item('c1'), address: '서울특별시 종로구 사직로 161', overview: '조선의 법궁', sidoName: '서울특별시', sigunguName: '종로구',
    contentTypeId: '12', closureState: 'WEEKLY', closedWeekdays: ['MON'], attrAdmission: 'FREE', attrParking: 'YES',
    distanceKm: 0.4567, savedCount: 5, ...over,
  });
  const renderWith = async (a: Attraction, path = '/place') => {
    vi.mocked(searchAttractions).mockResolvedValue({
      searchId: 's', attractions: [a], totalElements: 1, totalPages: 1, currentPage: 0,
    });
    renderPage(path);
    return (await screen.findByText(a.title)).closest('a')!;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    mobile = false;
    stubMedia();
    vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
    vi.mocked(suggestPlaces).mockResolvedValue([]);
    vi.mocked(searchAttractions).mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('주소 줄이 없고, meta 줄에 분류 · 지역 라벨 · 거리 · 찜, 배지 목록, 개요가 그 순서로 있다', async () => {
    vi.setSystemTime(new Date('2026-10-27T03:00:00Z')); // KST 화요일
    const el = await renderWith(card({}));
    expect(el.querySelector('.place-card-addr')).toBeNull();
    expect(el.textContent).not.toContain('사직로');
    const meta = el.querySelector('.place-card-meta')!;
    expect(meta.querySelector('.place-card-region')?.textContent).toBe('서울특별시 종로구');
    expect(meta.textContent).toContain('자연');
    expect(meta.textContent).toContain('457m');
    expect(Array.from(el.querySelectorAll('.place-card-badges li')).map((li) => li.textContent)).toEqual([
      '월 휴무', '입장 무료', '주차 가능',
    ]);
    const body = el.querySelector('.place-card-body')!;
    const order = Array.from(body.children).map((c) => c.className);
    expect(order).toEqual(['place-card-title', 'place-card-meta', 'place-card-badges', 'place-card-overview']);
  });

  it('찜 수 — 보이는 「찜 n」은 aria-hidden, 옆에 읽기 문구가 있다. 하한 미만은 그리지 않는다', async () => {
    vi.setSystemTime(new Date('2026-10-27T03:00:00Z'));
    const el = await renderWith(card({}));
    const visible = el.querySelector('.place-card-saved')!;
    expect(visible.textContent).toBe('찜 5');
    expect(visible).toHaveAttribute('aria-hidden', 'true');
    expect(el.querySelector('.place-card-meta .place-sr-only')?.textContent).toBe('이 사이트 회원 5명이 찜');
    cleanup();

    const low = await renderWith(card({ savedCount: 2 }));
    expect(low.querySelector('.place-card-saved')).toBeNull();
  });

  it('배지가 없으면 목록을 그리지 않는다', async () => {
    vi.setSystemTime(new Date('2026-10-27T03:00:00Z'));
    const el = await renderWith(card({ closureState: 'UNKNOWN', attrAdmission: 'PAID', attrParking: 'NO' }));
    expect(el.querySelector('.place-card-badges')).toBeNull();
  });

  // 호출부가 렌더 시점의 todayKst() 를 넘기는지 — UTC 로는 아직 일요일인 KST 월요일 00:30
  it('UTC 일요일 15:30(= KST 월요일)에는 월요일 휴무 카드가 「오늘은 정기휴무일」이고 규칙 기준 읽기 문구가 붙는다', async () => {
    vi.setSystemTime(new Date('2026-10-25T15:30:00Z'));
    const el = await renderWith(card({}));
    const first = el.querySelector('.place-card-badges li')!;
    expect(first).toHaveClass('is-closed-today');
    expect(first.querySelector('[aria-hidden="true"]')?.textContent).toBe('오늘은 정기휴무일');
    expect(first.querySelector('.place-sr-only')?.textContent).toBe('오늘은 정기휴무일(매주 월 휴무 규칙 기준)');
  });

  it('KST 화요일에는 같은 카드가 「월 휴무」다', async () => {
    vi.setSystemTime(new Date('2026-10-26T15:30:00Z'));
    const el = await renderWith(card({}));
    expect(el.querySelector('.place-card-badges li')?.textContent).toBe('월 휴무');
  });

  it('영문 카드 — 「시군구, 시도」와 영문 배지', async () => {
    vi.setSystemTime(new Date('2026-10-27T03:00:00Z'));
    const el = await renderWith(card({ lang: 'en', sidoName: 'Seoul', sigunguName: 'Jongno-gu' }), '/en/place');
    expect(el.querySelector('.place-card-region')?.textContent).toBe('Jongno-gu, Seoul');
    expect(Array.from(el.querySelectorAll('.place-card-badges li')).map((li) => li.textContent)).toEqual([
      'Closed Mon', 'Free admission', 'Parking',
    ]);
  });
});

describe('PlacePage 행사·여행코스·숙박', () => {
  // 오늘 = 2026-10-26(월) KST. Date 만 고정한다 — react-query 의 타이머는 그대로 둔다.
  const NOW = new Date('2026-10-26T03:00:00Z');
  const festival: Attraction = {
    ...item('ev1'), title: '불꽃축제', category: 'festival', contentTypeId: '15',
    eventStart: '2026-10-30', eventEnd: '2026-11-02',
  };
  const ended: Attraction = {
    ...item('ev2'), title: '지난 축제', category: 'festival', contentTypeId: '15',
    eventStart: '2026-09-01', eventEnd: '2026-09-28',
  };
  const unknown: Attraction = { ...item('ev3'), title: '날짜 모름', category: 'festival', contentTypeId: '15' };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    mobile = false;
    stubMedia();
    vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
    vi.mocked(suggestPlaces).mockResolvedValue([]);
    vi.mocked(searchAttractions).mockReset();
    vi.mocked(searchAttractions).mockResolvedValue({
      searchId: 's', attractions: [item('a1'), festival, ended, unknown], totalElements: 4, totalPages: 1, currentPage: 0,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const categoryChips = () =>
    Array.from(openFilters().querySelectorAll('.place-filters [data-category]')).map((el) => el.getAttribute('data-category'));

  it('국문은 행사·여행코스 칩을, 영문은 행사 칩만 그린다 — 영문 코스는 0건이다', async () => {
    renderPage();
    await screen.findByText('관광지 a1');
    expect(categoryChips()).toEqual(['nature', 'history', 'culture', 'leisure', 'festival', 'course']);
    cleanup();

    renderPage('/en/place');
    await screen.findByText('관광지 a1');
    expect(categoryChips()).toEqual(['nature', 'history', 'culture', 'leisure', 'festival']);
    expect(screen.queryByRole('button', { name: 'Courses' })).toBeNull();
    expect(within(openFilters()).getByRole('button', { name: 'Events' })).toBeInTheDocument();
  });

  it('행사 칩은 상태 칩을 열고 기본 NOT_ENDED · 시작일 순으로 받는다. 상태 칩을 고르면 그 값, 다시 누르면 풀린다', async () => {
    renderPage();
    await screen.findByText('관광지 a1');
    expect(screen.queryByRole('group', { name: '행사 상태' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '행사' }));
    // 행사 상태 칩은 「필터」 안에 있다
    const group = await within(openFilters()).findByRole('group', { name: '행사 상태' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['진행 중', '이번 주말', '예정']);
    await waitFor(() =>
      expect(calls().at(-1)).toMatchObject({ category: 'festival', eventStatus: 'NOT_ENDED', sort: 'eventStart' }),
    );

    fireEvent.click(within(group).getByRole('button', { name: '이번 주말' }));
    await waitFor(() => expect(calls().at(-1)).toMatchObject({ category: 'festival', eventStatus: 'WEEKEND', page: 0 }));
    expect(within(group).getByRole('button', { name: '이번 주말' })).toHaveAttribute('aria-pressed', 'true');

    // 다시 누르면 풀린다 — 같은 조건(NOT_ENDED)은 캐시에서 나와 새 요청이 없을 수 있어 칩 상태로 본다
    fireEvent.click(within(group).getByRole('button', { name: '이번 주말' }));
    expect(within(group).getByRole('button', { name: '이번 주말' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('검색어가 있는 「전체」는 관광 분류에 행사를 더하고 NOT_ENDED 를 보낸다 — 검색어가 없으면 관광 분류만', async () => {
    renderPage();
    await screen.findByText('관광지 a1');
    expect(calls()[0].category).toBe('nature,history,culture,leisure');
    expect(calls()[0].eventStatus).toBeUndefined();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '보령 머드축제' } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    await waitFor(() =>
      expect(calls().at(-1)).toMatchObject({
        keyword: '보령 머드축제',
        category: 'nature,history,culture,leisure,festival',
        eventStatus: 'NOT_ENDED',
        sort: 'relevance',
      }),
    );

    // 분류를 고르면 그 분류만 — 행사 조건은 붙지 않는다
    fireEvent.click(screen.getByRole('button', { name: '자연' }));
    await waitFor(() => expect(calls().at(-1)).toMatchObject({ keyword: '보령 머드축제', category: 'nature' }));
    expect(calls().at(-1)!.eventStatus).toBeUndefined();
  });

  it('숙박은 목록 칩이 아니라 지도 오버레이 토글이다', async () => {
    renderPage();
    await screen.findByText('관광지 a1');
    const stay = within(openFilters()).getByRole('button', { name: '숙박' });
    expect(stay).toHaveClass('overlay');
    expect(stay).toHaveAttribute('aria-pressed', 'false');
    expect(categoryChips()).not.toContain('stay');
    fireEvent.click(stay);
    // 넓은 화면은 켜는 순간 다이얼로그를 닫는다 — 다시 열어 켜진 상태를 본다
    expect(within(openFilters()).getByRole('button', { name: '숙박' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('목록 카드에 행사 기간과 상태를 그린다 — 날짜를 모르는 행사와 관광지는 그리지 않는다', async () => {
    renderPage();
    const card = (await screen.findByText('불꽃축제')).closest('a')!;
    expect(within(card).getByText('2026-10-30 ~ 2026-11-02')).toBeInTheDocument();
    expect(within(card).getByText('D-4 시작')).toBeInTheDocument();

    const endedCard = screen.getByText('지난 축제').closest('a')!;
    expect(within(endedCard).getByText('종료된 행사')).toBeInTheDocument();
    expect(endedCard.querySelector('.place-event-line')).toHaveAttribute('data-event-status', 'ENDED');

    expect(screen.getByText('날짜 모름').closest('a')!.querySelector('.place-event-line')).toBeNull();
    expect(screen.getByText('관광지 a1').closest('a')!.querySelector('.place-event-line')).toBeNull();
  });

  it('모바일 바텀시트 본문에도 같은 기간·상태 줄을 그린다(영문 문구)', async () => {
    mobile = true;
    stubMedia();
    vi.mocked(fetchAttraction).mockResolvedValue({ ...festival, lang: 'en', eventStart: '2026-10-27', eventEnd: '2026-10-27' });
    renderPage('/en/place');
    fireEvent.click(await screen.findByText('불꽃축제'));

    const sheet = await screen.findByRole('dialog', { name: 'Attraction' });
    await within(sheet).findByText('Starts tomorrow');
    expect(within(sheet).getByText('2026-10-27 ~ 2026-10-27')).toBeInTheDocument();
  });
});

/*
 * 허브 행동 계측 (ADR-0095). 판정 근거는 `track` 대역이 받은 인자 — 화면이 내놓은 값이다.
 * 트리거는 조작 시점의 ref 로 남기므로, 아는 조작만 일으키는 이 묶음에서 `other` 가 나오면 ref 누락이다.
 */
describe('PlacePage 계측', () => {
  const seoul: AdministrativeRegion = {
    code: '11', parentCode: null, level: 'SIDO', name: '서울특별시', nameEn: 'Seoul', latitude: 37.56, longitude: 126.97, attractionCount: 4321,
  };
  const jongno: AdministrativeRegion = {
    code: '11110', parentCode: '11', level: 'SIGUNGU', name: '종로구', nameEn: 'Jongno-gu', latitude: 37.57, longitude: 126.98, attractionCount: 300,
  };
  const tracked = (action: string) => vi.mocked(track).mock.calls.filter(([a]) => a === action);
  const searchPayloads = () => tracked('SEARCH').map(([, item]) => item.payload as Record<string, unknown>);
  const lastSearch = () => tracked('SEARCH').at(-1)!;
  const triggers = () => searchPayloads().map((p) => p.trigger);
  const cardOf = (title: string) => screen.getByText(title).closest('a')!;
  /** 자동 시도 선택(서울)까지 끝난 상태 — 그 view 의 SEARCH 가 `initial` 이다 */
  const untilInitial = () => waitFor(() => expect(triggers()).toEqual(['landing', 'initial']));

  beforeEach(() => {
    mobile = false;
    stubMedia();
    sessionStorage.clear();
    resetPlaceSessionForTest();
    vi.mocked(fetchAdministrativeRegions).mockImplementation(({ level }) =>
      Promise.resolve(level === 'SIDO' ? [seoul] : [jongno]),
    );
    vi.mocked(suggestPlaces).mockResolvedValue([]);
    vi.mocked(fetchAttraction).mockImplementation((id) => Promise.resolve(item(id)));
    vi.mocked(searchAttractions).mockReset();
    vi.mocked(searchAttractions).mockImplementation((q) => respond(q, () => facets()));
  });
  afterEach(() => {
    const seen = triggers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    cleanup();
    // 안전망 `other` 는 운영에서 조용히 분모에만 들어간다 — 여기서는 곧 ref 를 안 심은 핸들러다
    expect(seen).not.toContain('other');
  });

  describe('세션 시작', () => {
    it('첫 마운트에 SESSION_START 를 한 번 — PAGE/place-hub, screenRef 빈 값, 섹션 키 없음. 다시 마운트해도 0', async () => {
      const first = renderPage();
      await screen.findByText('관광지 a0-1');
      const starts = tracked('SESSION_START');
      expect(starts).toHaveLength(1);
      expect(starts[0][1]).toEqual({ entityType: 'PAGE', entityId: 'place-hub', screenType: 'PLACE_HUB', screenRef: '' });
      expect('sectionId' in starts[0][1]).toBe(false);
      expect(starts[0][2]).toEqual(expect.any(String));

      first.unmount();
      renderPage();
      await screen.findByText('관광지 a0-1');
      expect(tracked('SESSION_START')).toHaveLength(1);
    });

    it('sessionStorage 를 비우고 초기화하면 다시 한 번', async () => {
      const first = renderPage();
      await screen.findByText('관광지 a0-1');
      first.unmount();

      sessionStorage.clear();
      resetPlaceSessionForTest();
      renderPage();
      await screen.findByText('관광지 a0-1');
      expect(tracked('SESSION_START')).toHaveLength(2);
    });

    it('저장소가 실패해도 한 번만 — 모듈 변수가 대신한다', async () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });
      try {
        const first = renderPage();
        await screen.findByText('관광지 a0-1');
        expect(tracked('SESSION_START')).toHaveLength(1);
        first.unmount();
        renderPage();
        await screen.findByText('관광지 a0-1');
        expect(tracked('SESSION_START')).toHaveLength(1);
      } finally {
        setItem.mockRestore();
      }
    });
  });

  describe('SEARCH — 검색 제출·필터 적용', () => {
    it('첫 진입 — landing(시도 없음) 뒤 자동 시도 선택의 initial: screenRef 11 · entityId * · 좌표·keyword 키 없음', async () => {
      renderPage();
      await screen.findByText('관광지 a0-1');
      await untilInitial();

      const [landing, initial] = tracked('SEARCH');
      expect(landing[1]).toMatchObject({ entityType: 'SEARCH', entityId: '*', screenRef: '', payload: { trigger: 'landing' } });
      expect(initial[1]).toMatchObject({
        entityType: 'SEARCH', entityId: '*', screenType: 'PLACE_HUB', screenRef: '11', sectionId: 'ATTRACTION_LIST',
        payload: { trigger: 'initial', term: '', sido: '11', total: 6, page: 0 },
      });
      for (const key of ['keyword', 'lat', 'lng', 'geo']) expect(initial[1].payload).not.toHaveProperty(key);
      expect(initial[2]).not.toBe(landing[2]);
    });

    it('지역 축이 없으면 landing 한 건 — entityId * · 0건 응답도 보낸다', async () => {
      vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
      vi.mocked(searchAttractions).mockResolvedValue({ searchId: 's', attractions: [], totalElements: 0, totalPages: 0, currentPage: 0 });
      renderPage();
      await screen.findByText('검색 결과가 없습니다');
      await waitFor(() => expect(triggers()).toEqual(['landing']));
      expect(lastSearch()[1]).toMatchObject({ entityId: '*', screenRef: '', payload: { trigger: 'landing', total: 0 } });
    });

    it('submit — 검색어 확정', async () => {
      renderPage();
      await untilInitial();
      fireEvent.change(screen.getByRole('textbox'), { target: { value: ' 궁궐 ' } });
      fireEvent.click(screen.getByRole('button', { name: '검색' }));
      await waitFor(() => expect(lastSearch()[1].payload).toMatchObject({ trigger: 'submit', term: '궁궐', changed: ['keyword'] }));
      expect(lastSearch()[1].entityId).toBe('궁궐');
    });

    it('suggestion — 자동완성 선택은 SEARCH 한 건이고 CLICK 이 아니다. 반경만 남고 좌표는 없다', async () => {
      vi.mocked(suggestPlaces).mockResolvedValue([
        { type: 'ATTRACTION', id: 's1', title: '경복궁', latitude: 37.57, longitude: 126.98, regionLevel: null, category: 'history' },
      ]);
      renderPage();
      await untilInitial();
      fireEvent.change(screen.getByRole('textbox'), { target: { value: '경복' } });
      fireEvent.mouseDown(await screen.findByRole('option', { name: /경복궁/ }));
      await waitFor(() => expect(lastSearch()[1].payload).toMatchObject({ trigger: 'suggestion', radiusKm: 5 }));
      for (const key of ['lat', 'lng', 'geo', 'keyword']) expect(lastSearch()[1].payload).not.toHaveProperty(key);
      expect(tracked('CLICK')).toHaveLength(0);
    });

    it('nearMe — 반경 5km 만 싣고 기기 좌표는 싣지 않는다', async () => {
      renderPage();
      await untilInitial();
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 37.5, longitude: 127 } } as GeolocationPosition) },
      });
      try {
        fireEvent.click(screen.getByRole('button', { name: '내 주변' }));
        await waitFor(() => expect(lastSearch()[1].payload).toMatchObject({ trigger: 'nearMe', radiusKm: 5 }));
        for (const key of ['lat', 'lng', 'geo', 'keyword']) expect(lastSearch()[1].payload).not.toHaveProperty(key);
      } finally {
        Reflect.deleteProperty(navigator, 'geolocation');
      }
    });

    it('region — 구 지역 축 <select> 는 changed: [areaCode]', async () => {
      vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
      renderPage();
      await waitFor(() => expect(triggers()).toEqual(['landing']));
      fireEvent.change(within(openFilters()).getByLabelText('Area'), { target: { value: '6' } });
      await waitFor(() => expect(lastSearch()[1].payload).toMatchObject({ trigger: 'region', changed: ['areaCode'] }));
    });

    it('region — 시군구 선택은 screenRef 가 시도+시군구(11110) 다', async () => {
      renderPage();
      await untilInitial();
      // 지역 트리거 → 시군구 행 — 시도를 고른 상태면 시트가 그 시도의 시군구 목록에서 열린다
      fireEvent.click(await screen.findByRole('button', { name: /서울특별시/ }));
      const sheet = await screen.findByRole('dialog', { name: '지역 선택' });
      fireEvent.click(await within(sheet).findByRole('button', { name: /종로구/ }));
      await waitFor(() =>
        expect(lastSearch()[1]).toMatchObject({ screenRef: '11110', payload: { trigger: 'region', sido: '11', sigungu: '110' } }),
      );
    });

    it('category — 분류 칩은 category·listEventStatus·page 를 함께 바꾼다', async () => {
      renderPage();
      await untilInitial();
      fireEvent.click(screen.getByRole('button', { name: '자연' }));
      await waitFor(() => expect(lastSearch()[1].payload).toMatchObject({ trigger: 'category', category: 'nature' }));
      expect(lastSearch()[1].payload!.changed).toEqual(['category', 'listEventStatus', 'page']);
    });

    it('attribute — 속성 칩', async () => {
      renderPage();
      await untilInitial();
      fireEvent.click(chip(/^주차 가능/));
      await waitFor(() => expect(lastSearch()[1].payload).toMatchObject({ trigger: 'attribute', attributes: ['parking'] }));
    });

    it('eventStatus — 행사 상태 칩', async () => {
      renderPage();
      await untilInitial();
      fireEvent.click(screen.getByRole('button', { name: '행사' }));
      await waitFor(() => expect(lastSearch()[1].payload).toMatchObject({ trigger: 'category', category: 'festival' }));
      fireEvent.click(within(within(openFilters()).getByRole('group', { name: '행사 상태' })).getByRole('button', { name: '이번 주말' }));
      await waitFor(() => expect(lastSearch()[1].payload).toMatchObject({ trigger: 'eventStatus', changed: ['listEventStatus', 'page'] }));
    });

    it('page — 데스크톱 다음 쪽', async () => {
      renderPage();
      await untilInitial();
      fireEvent.click(screen.getByRole('button', { name: '다음' }));
      await waitFor(() => expect(lastSearch()[1].payload).toMatchObject({ trigger: 'page', page: 1, changed: ['page'] }));
    });

    it('lang — 언어 전환은 새 view 의 SEARCH 로 남는다', async () => {
      renderPage();
      await untilInitial();
      const before = lastSearch()[2];
      fireEvent.click(screen.getByRole('button', { name: 'EN' }));
      await waitFor(() => expect(lastSearch()[1].payload).toMatchObject({ trigger: 'lang', changed: ['lang'] }));
      expect(lastSearch()[2]).not.toBe(before);
    });

    it('같은 응답으로 다시 그려져도 같은 view 에 두 번 보내지 않는다', async () => {
      vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
      renderPage();
      await screen.findByText('관광지 a0-1');
      await waitFor(() => expect(triggers()).toEqual(['landing']));
      fireEvent.click(cardOf('관광지 a0-1'));
      await screen.findByRole('link', { name: '구글맵에서 보기' });
      expect(tracked('SEARCH')).toHaveLength(1);
    });

    it('오버레이 칩 토글은 목록 질의가 아니다 — SEARCH 없음, viewId 그대로', async () => {
      vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
      renderPage();
      await screen.findByText('관광지 a0-1');
      await waitFor(() => expect(triggers()).toEqual(['landing']));
      const before = screen.getAllByTestId('fav')[0].dataset.view;
      fireEvent.click(within(openFilters()).getByRole('button', { name: '숙박' }));
      expect(within(openFilters()).getByRole('button', { name: '숙박' })).toHaveAttribute('aria-pressed', 'true');
      expect(tracked('SEARCH')).toHaveLength(1);
      expect(screen.getAllByTestId('fav')[0].dataset.view).toBe(before);
    });

    it('재시도 뒤에도 실패한 질의는 보내지 않는다', async () => {
      vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
      vi.mocked(searchAttractions).mockRejectedValue(new Error('down'));
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      renderPage();
      // retry 3 — 지수 지연 1·2·4초를 넘긴다. 마지막 거절의 통지는 setTimeout 0 이라 가짜 시계를 1ms 더 민다
      // (0ms 전진은 그 시각에 새로 잡힌 0 지연 타이머를 돌리지 않는다)
      for (const ms of [0, 1000, 2000, 4000, 1]) await advance(ms);
      expect(screen.getByText('목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
      expect(vi.mocked(searchAttractions)).toHaveBeenCalledTimes(4);
      expect(tracked('SEARCH')).toHaveLength(0);
    });
  });

  describe('CLICK — 결과 선택 · 지도 열기', () => {
    it('카드 좌클릭 — ATTRACTION_LIST · source card · itemIndex, SEARCH 와 같은 viewId·screenRef, 기본 동작은 막는다', async () => {
      renderPage();
      await untilInitial();
      const [, search, viewId] = lastSearch();
      expect(search.screenRef).toBe('11');

      expect(fireEvent.click(cardOf('관광지 a0-2'))).toBe(false);
      const [click] = tracked('CLICK');
      expect(click[1]).toEqual({
        entityType: 'ATTRACTION', entityId: 'a0-2', screenType: 'PLACE_HUB', screenRef: '11',
        sectionId: 'ATTRACTION_LIST', itemIndex: 1, payload: { source: 'card', badges: [] },
      });
      expect(click[2]).toBe(viewId);
    });

    it('수정키 좌클릭 — 기본 동작(새 탭)을 두고 newTab: true 로 남긴다', async () => {
      renderPage();
      await untilInitial();
      expect(fireEvent.click(cardOf('관광지 a0-1'), { metaKey: true })).toBe(true);
      expect(tracked('CLICK')[0][1]).toMatchObject({ entityId: 'a0-1', itemIndex: 0, payload: { source: 'card', newTab: true } });
    });

    it('패널 지도 링크 — MAP_LINK · google_maps_search, 기본 동작 유지, 같은 view', async () => {
      renderPage();
      await untilInitial();
      const viewId = lastSearch()[2];
      fireEvent.click(cardOf('관광지 a0-1'));
      const link = await screen.findByRole('link', { name: '구글맵에서 보기' });

      expect(fireEvent.click(link)).toBe(true);
      const mapClick = tracked('CLICK').find(([, i]) => i.sectionId === 'MAP_LINK')!;
      expect(mapClick[1]).toEqual({
        entityType: 'ATTRACTION', entityId: 'a0-1', screenType: 'PLACE_HUB', screenRef: '11',
        sectionId: 'MAP_LINK', payload: { kind: 'google_maps_search' },
      });
      expect(mapClick[2]).toBe(viewId);
    });
  });

  describe('IMPRESSION — 카드 노출', () => {
    it('카드마다 ATTRACTION_LIST·itemIndex 로 한 번, 패널을 열어도 MAP_LINK·FAVORITE 노출은 없다', async () => {
      const io = installIntersectionObserver();
      renderPage();
      await untilInitial();
      const viewId = lastSearch()[2];
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      io.show(1);
      await advance(DWELL_MS);
      const impressions = tracked('IMPRESSION');
      expect(impressions.map(([, i, v]) => [i.entityId, i.sectionId, i.itemIndex, i.screenRef, v])).toEqual([
        ['a0-1', 'ATTRACTION_LIST', 0, '11', viewId],
        ['a0-2', 'ATTRACTION_LIST', 1, '11', viewId],
      ]);

      fireEvent.click(cardOf('관광지 a0-1'));
      await advance(0);
      expect(screen.getByRole('link', { name: '구글맵에서 보기' })).toBeInTheDocument();
      io.show(1);
      await advance(DWELL_MS);
      // 패널·지도 링크·찜은 노출을 보내지 않는다 — 카드가 다시 그려져 또 찍히는 것은 실제 트래커가 키로 거른다
      const sections = tracked('IMPRESSION').map(([, i]) => i.sectionId);
      expect(sections.every((s) => s === 'ATTRACTION_LIST')).toBe(true);
      expect(sections.filter((s) => s === 'MAP_LINK' || s === 'FAVORITE')).toHaveLength(0);
    });
  });

  describe('찜 배선', () => {
    it('카드·패널의 찜 버튼은 그 view 의 viewId 와 지역 코드를 받는다', async () => {
      renderPage();
      await untilInitial();
      const [, search, viewId] = lastSearch();
      const favs = screen.getAllByTestId('fav');
      expect(favs.map((f) => f.dataset.key)).toEqual(['a0-1', 'a0-2']);
      for (const f of favs) {
        expect(f.dataset.view).toBe(viewId);
        expect(f.dataset.ref).toBe(search.screenRef);
      }

      fireEvent.click(cardOf('관광지 a0-1'));
      const panel = await screen.findByRole('complementary', { name: '관광지 a0-1' });
      const panelFav = within(panel).getByTestId('fav');
      expect(panelFav.dataset.key).toBe('a0-1');
      expect(panelFav.dataset.view).toBe(viewId);
      expect(panelFav.dataset.ref).toBe('11');
    });
  });
});

describe('PlacePage 사진 주소 https', () => {
  const TONG = 'http://tong.visitkorea.or.kr/cms/resource/';
  // 썸네일이 있는 카드와 원본만 있는 카드를 섞는다 — 카드는 썸네일 우선, 패널은 원본을 쓴다
  const photoItem = (id: string, withThumb: boolean): Attraction => ({
    ...item(id),
    imageUrl: `${TONG}${id}/origin.jpg`,
    thumbnailUrl: withThumb ? `${TONG}${id}/thumb.jpg` : null,
  });
  const page = () => ({
    searchId: 's',
    attractions: [photoItem('h1', true), photoItem('h2', false)],
    totalElements: 2,
    totalPages: 1,
    currentPage: 0,
  });
  const httpsTong = (root: ParentNode) => root.querySelectorAll('img[src^="https://tong."]').length;
  const httpTong = (root: ParentNode) =>
    root.querySelectorAll('img[src^="http://tong."], [data-src^="http://tong."]').length;

  beforeEach(() => {
    mobile = false;
    stubMedia();
    vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
    vi.mocked(suggestPlaces).mockResolvedValue([]);
    vi.mocked(searchAttractions).mockReset();
    vi.mocked(searchAttractions).mockImplementation(() => Promise.resolve(page()));
    vi.mocked(fetchAttraction).mockImplementation((id) => Promise.resolve(photoItem(String(id), true)));
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('카드와 상세 패널이 http tong 원천을 https 로 그린다', async () => {
    renderPage();
    await screen.findByText('관광지 h1');
    expect(httpsTong(document)).toBeGreaterThanOrEqual(2);
    expect(httpTong(document)).toBe(0);

    fireEvent.click(screen.getByText('관광지 h1'));
    const panel = await screen.findByRole('complementary', { name: '관광지 h1' });
    await waitFor(() => expect(panel.querySelector('img.place-detail-img')).not.toBeNull());
    expect(httpsTong(panel)).toBeGreaterThanOrEqual(1);
    expect(httpTong(document)).toBe(0);
  });

  it('뽑기 시트 카드의 사진 주소도 https', async () => {
    renderPage();
    await screen.findByText('관광지 h1');
    fireEvent.click(screen.getByRole('button', { name: '뽑기' }));

    const photos = () => Array.from(document.querySelectorAll<HTMLElement>('.cd-photo'));
    const httpsPhoto = (el: HTMLElement) =>
      (el.getAttribute('data-src') ?? '').startsWith('https://tong.') || el.style.backgroundImage.includes('https://tong.');
    await waitFor(() => expect(photos().filter(httpsPhoto).length).toBeGreaterThanOrEqual(1));
    expect(document.querySelectorAll('[data-src^="http://tong."]')).toHaveLength(0);
    expect(photos().filter((el) => el.style.backgroundImage.includes('http://tong.'))).toHaveLength(0);
  });
});
