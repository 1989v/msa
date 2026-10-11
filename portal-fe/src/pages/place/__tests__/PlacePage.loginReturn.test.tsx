import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdministrativeRegion, Attraction, AttractionQuery } from '../../../api/placeApi';
import type { FavoriteItem } from '../../../api/wishlistApi';

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
vi.mock('../../../analytics/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../analytics/tracker')>()),
  track: vi.fn(),
}));
// FavoriteButton 은 대역이 없다 — 의도 저장과 허브 상태 저장이 실제 별 클릭에서 일어나는지가 이 파일의 요점이다

import { fetchAdministrativeRegions, fetchAttraction, searchAttractions, suggestPlaces } from '../../../api/placeApi';
import { addFavorite, fetchFavoriteKeys, removeFavorite } from '../../../api/wishlistApi';
import { track } from '../../../analytics/tracker';
import PlacePage, { resetPlaceSessionForTest } from '../PlacePage';

const INTENT_KEY = 'kgd.favoriteIntent.v1';
const HUB_STATE_KEY = 'kgd.placeHubState.v1';
const MOBILE_QUERY = '(max-width: 899.98px)';

const seoul: AdministrativeRegion = {
  code: '11', parentCode: null, level: 'SIDO', name: '서울특별시', nameEn: 'Seoul', latitude: 37.56, longitude: 126.97, attractionCount: 4321,
};

const item = (id: string): Attraction => ({
  id, contentId: id, lang: 'ko', title: `관광지 ${id}`, category: 'nature', areaCode: null,
  address: null, latitude: 37.5, longitude: 127, imageUrl: null, tel: null, overview: null,
  distanceKm: null, position: 0,
});

/** 쪽마다 다른 두 관광지 — 모바일 복원이 첫 쪽에 없는 선택을 버리는지 본다 */
function respond(q: AttractionQuery) {
  const p = q.page ?? 0;
  const base = p * 10;
  return Promise.resolve({
    searchId: 's', attractions: [item(String(base + 1)), item(String(base + 2))], totalElements: 60, totalPages: 3,
    currentPage: p, attributeFacets: null,
  });
}

const favoriteItem = (targetKey: string): FavoriteItem => ({
  id: 1, targetType: 'ATTRACTION', targetKey, collectionId: null, createdAt: '2026-10-09T00:00:00Z',
});

function stubMedia(mobile: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === MOBILE_QUERY ? mobile : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderPage({ path = '/place', strict = false }: { path?: string; strict?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tree = (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <PlacePage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

/** 토큰은 HttpOnly 라 JS 가 못 본다 — 로그인 여부는 표시 쿠키로 본다 (ADR-0101) */
function setSession(memberId: string | null) {
  document.cookie = memberId
    ? `portal_user_id=${memberId}; Path=/`
    : 'portal_user_id=; Path=/; Max-Age=0';
}

/** 로그인은 apex 로 가는 호스트 간 이동이다 — jsdom 이 막으므로 href 대입만 가로챈다 */
function interceptNavigation() {
  const assigned: string[] = [];
  const original = Object.getOwnPropertyDescriptor(window, 'location');
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, get href() { return 'http://localhost/place'; }, set href(v: string) { assigned.push(v); } },
  });
  return { assigned, restore: () => original && Object.defineProperty(window, 'location', original) };
}

const searches = () => vi.mocked(track).mock.calls.filter(([a]) => a === 'SEARCH').map(([, e]) => e);
const triggers = () => searches().map((e) => e.payload?.trigger);
const favoriteClicks = () =>
  vi.mocked(track).mock.calls.filter(([a, e]) => a === 'CLICK' && e.sectionId === 'FAVORITE').map(([, e]) => e);
const queries = () => vi.mocked(searchAttractions).mock.calls.map(([q]) => q);
const cardOf = (title: string) => screen.getByText(title).closest('a')!;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

/** 허브 상태 한 벌 — 경계 테스트는 이것에서 한 필드씩 망가뜨린다 */
const hubState = (over: Record<string, unknown> = {}) => ({
  keyword: '',
  exactFor: null,
  category: 'nature',
  attributes: [],
  areaCode: null,
  sidoCode: '11',
  sigunguCode: null,
  geo: null,
  listEventStatus: null,
  selectedId: null,
  page: 0,
  createdAt: Date.now(),
  ...over,
});
const seedHubState = (over: Record<string, unknown> = {}) =>
  sessionStorage.setItem(HUB_STATE_KEY, JSON.stringify(hubState(over)));
const seedIntent = (targetKey: string, createdAt = Date.now()) =>
  sessionStorage.setItem(INTENT_KEY, JSON.stringify({ targetType: 'ATTRACTION', targetKey, createdAt }));

let savedKeys: Set<string>;

beforeEach(() => {
  stubMedia(false);
  setSession(null);
  sessionStorage.clear();
  localStorage.clear();
  resetPlaceSessionForTest();
  savedKeys = new Set();
  vi.mocked(fetchAdministrativeRegions).mockImplementation(({ level }) =>
    Promise.resolve(level === 'SIDO' ? [seoul] : []),
  );
  vi.mocked(suggestPlaces).mockResolvedValue([]);
  vi.mocked(fetchAttraction).mockImplementation((id) => Promise.resolve(item(id)));
  vi.mocked(searchAttractions).mockImplementation(respond);
  vi.mocked(fetchFavoriteKeys).mockImplementation(() => Promise.resolve([...savedKeys]));
  vi.mocked(addFavorite).mockImplementation((_type, key) => {
    savedKeys.add(key);
    return Promise.resolve(favoriteItem(key));
  });
  vi.mocked(removeFavorite).mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  setSession(null);
  sessionStorage.clear();
});

describe('허브 로그인 복귀 — 이어 붙인 시나리오', () => {
  it('게스트 필터·선택 → 별 → 로그인 → StrictMode 재마운트: 조건·선택 복원, SEARCH restore 1건, PUT 1회, 의도 삭제, resumed 계측 1건', async () => {
    // ① 게스트로 허브 — 자동 시도(서울)까지 끝난다
    renderPage();
    await waitFor(() => expect(triggers()).toEqual(['landing', 'initial']));
    // ② 필터 조작: 분류 「역사」(「필터」 다이얼로그 안) + 2쪽 + 카드 선택
    fireEvent.click(screen.getByRole('button', { name: /^필터/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '필터' })).getByRole('button', { name: '역사' }));
    await waitFor(() => expect(queries().at(-1)).toMatchObject({ category: 'history', page: 0 }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(await screen.findByRole('button', { name: '다음' }));
    await screen.findByText('관광지 11');
    fireEvent.click(cardOf('관광지 11'));
    await screen.findByRole('complementary', { name: '관광지 11' });

    // ③ 목록 카드의 별(12) — 로그인으로 이동하기 직전에 의도·화면 상태가 남는다
    const nav = interceptNavigation();
    fireEvent.click(within(cardOf('관광지 12')).getByRole('button', { name: '관광지 찜' }));
    nav.restore();
    expect(nav.assigned.at(-1)).toContain('/login?next=');
    expect(JSON.parse(sessionStorage.getItem(INTENT_KEY)!)).toMatchObject({ targetType: 'ATTRACTION', targetKey: '12' });
    expect(JSON.parse(sessionStorage.getItem(HUB_STATE_KEY)!)).toMatchObject({
      category: 'history', sidoCode: '11', page: 1, selectedId: '11',
    });
    expect(addFavorite).not.toHaveBeenCalled();

    // ④ 로그인하고 돌아온다 — 같은 sessionStorage, StrictMode(이중 마운트)
    cleanup();
    vi.mocked(track).mockClear();
    vi.mocked(searchAttractions).mockClear();
    resetPlaceSessionForTest();
    setSession('1');
    renderPage({ strict: true });

    // 질의 인자 복원 — 자동 시도 선택이 끼어들지 않는다
    await screen.findByText('관광지 12');
    expect(queries()[0]).toMatchObject({ category: 'history', sidoCode: '11', page: 1 });
    expect(queries().every((q) => q.category === 'history' && q.page === 1)).toBe(true);
    await screen.findByRole('complementary', { name: '관광지 11' });

    // 찜 완료: PUT 1회, 별이 차고, 알림이 뜬다
    await waitFor(() => expect(addFavorite).toHaveBeenCalledTimes(1));
    expect(addFavorite).toHaveBeenCalledWith('ATTRACTION', '12');
    await waitFor(() =>
      expect(within(cardOf('관광지 12')).getByRole('button', { name: '관광지 찜 해제' })).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(await screen.findByRole('status')).toHaveTextContent('찜했습니다');
    expect(sessionStorage.getItem(INTENT_KEY)).toBeNull();
    expect(sessionStorage.getItem(HUB_STATE_KEY)).toBeNull();

    // 계측: SEARCH 는 restore 하나, landing/initial 0 · 찜은 resumed 1건
    await waitFor(() => expect(favoriteClicks()).toHaveLength(1));
    await flush();
    expect(triggers()).toEqual(['restore']);
    expect(favoriteClicks()[0]).toMatchObject({
      entityType: 'ATTRACTION', entityId: '12', screenType: 'PLACE_HUB', screenRef: '11', sectionId: 'FAVORITE',
      payload: { saved: true, resumed: true },
    });
    // 자동 완료 찜은 복원한 화면의 view 에 붙는다
    const viewOf = (pred: (c: Parameters<typeof track>) => boolean) => vi.mocked(track).mock.calls.find(pred)![2];
    expect(viewOf(([a, e]) => a === 'CLICK' && e.sectionId === 'FAVORITE')).toBe(viewOf(([a]) => a === 'SEARCH'));
    expect(addFavorite).toHaveBeenCalledTimes(1);
    expect(removeFavorite).not.toHaveBeenCalled();
  });
});

describe('허브 로그인 복귀 — 의도 소비 경계', () => {
  beforeEach(() => setSession('1'));

  it('10분 지난 의도는 무시한다 — PUT 0', async () => {
    seedIntent('12', Date.now() - 10 * 60_000 - 1);
    renderPage();
    await screen.findByText('관광지 1');
    await waitFor(() => expect(fetchFavoriteKeys).toHaveBeenCalled());
    await flush();

    expect(addFavorite).not.toHaveBeenCalled();
    expect(favoriteClicks()).toHaveLength(0);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('이미 찜이면 아무것도 하지 않는다 — PUT·DELETE·알림·계측 0', async () => {
    savedKeys.add('2');
    seedIntent('2');
    renderPage();
    await waitFor(() =>
      expect(within(cardOf('관광지 2')).getByRole('button', { name: '관광지 찜 해제' })).toHaveAttribute('aria-pressed', 'true'),
    );
    await flush();

    expect(sessionStorage.getItem(INTENT_KEY)).toBeNull();
    expect(addFavorite).not.toHaveBeenCalled();
    expect(removeFavorite).not.toHaveBeenCalled();
    expect(favoriteClicks()).toHaveLength(0);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('/keys 가 늦게 오면 그 뒤에 PUT 한다 — 하이드레이션 전에는 찜을 보내지 않는다', async () => {
    let resolveKeys: ((keys: string[]) => void) | undefined;
    vi.mocked(fetchFavoriteKeys).mockImplementation(
      () => new Promise<string[]>((resolve) => { resolveKeys = resolve; }),
    );
    seedIntent('2');
    renderPage();
    await screen.findByText('관광지 2');
    await flush();

    // 의도는 첫 await 전에 이미 지웠다
    expect(sessionStorage.getItem(INTENT_KEY)).toBeNull();
    expect(addFavorite).not.toHaveBeenCalled();

    await act(async () => resolveKeys?.([]));
    await waitFor(() => expect(addFavorite).toHaveBeenCalledTimes(1));
    expect(addFavorite).toHaveBeenCalledWith('ATTRACTION', '2');
    await waitFor(() => expect(favoriteClicks()).toHaveLength(1));
    expect(favoriteClicks()[0].payload).toEqual({ saved: true, resumed: true });
  });

  it('PUT 이 실패하면 별은 비우고 의도를 지우고 console.warn 한 줄 — 알림·계측 없음', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(addFavorite).mockRejectedValue(new Error('down'));
    seedIntent('2');
    renderPage();
    await waitFor(() => expect(addFavorite).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    await flush();

    expect(within(cardOf('관광지 2')).getByRole('button', { name: '관광지 찜' })).toHaveAttribute('aria-pressed', 'false');
    expect(sessionStorage.getItem(INTENT_KEY)).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
    expect(favoriteClicks()).toHaveLength(0);
  });

  it('비로그인 재마운트 — 화면 상태는 복원하고, 의도는 남기고, PUT 0', async () => {
    setSession(null);
    seedHubState({ category: 'culture' });
    seedIntent('2');
    renderPage();
    await screen.findByText('관광지 1');
    await flush();

    expect(queries()[0]).toMatchObject({ category: 'culture', sidoCode: '11' });
    expect(triggers()).toEqual(['restore']);
    expect(sessionStorage.getItem(INTENT_KEY)).not.toBeNull();
    expect(sessionStorage.getItem(HUB_STATE_KEY)).toBeNull();
    expect(fetchFavoriteKeys).not.toHaveBeenCalled();
    expect(addFavorite).not.toHaveBeenCalled();
  });
});

describe('허브 상태 복원 — 외부 입력 검증', () => {
  it.each<[string, Record<string, unknown>]>([
    ['분류가 모르는 값', { category: 'casino' }],
    ['속성이 모르는 값', { attributes: ['parking', 'jacuzzi'] }],
    ['행사 상태가 모르는 값', { category: 'festival', listEventStatus: 'FOREVER' }],
    ['지역 코드가 숫자 아님', { sidoCode: '11; DROP' }],
    ['관광지 id 가 숫자 아님', { selectedId: '../admin' }],
    ['page 음수', { page: -1 }],
    ['page 정수 아님', { page: 1.5 }],
    ['geo 반쪽', { geo: { lat: 37.5, lng: 127 } }],
    ['radiusKm 0', { geo: { lat: 37.5, lng: 127, radiusKm: 0 } }],
    ['geo 가 유한하지 않음', { geo: { lat: 'x', lng: 127, radiusKm: 5 } }],
    ['exactFor 가 문자열 아님', { exactFor: 3 }],
    ['10분 지남', { createdAt: Date.now() - 10 * 60_000 - 1 }],
  ])('%s → 통째로 버리고 지운다', async (_name, over) => {
    seedHubState({ ...over, keyword: '경복궁' });
    renderPage();
    await waitFor(() => expect(triggers()).toEqual(['landing', 'initial']));

    // 한 필드라도 틀리면 나머지(검색어)도 복원하지 않는다
    expect(queries().some((q) => q.keyword === '경복궁')).toBe(false);
    expect(screen.getByLabelText(/^관광지 검색/)).toHaveValue('');
    expect(sessionStorage.getItem(HUB_STATE_KEY)).toBeNull();
  });

  it('JSON 이 아니면 버리고 지운다', async () => {
    sessionStorage.setItem(HUB_STATE_KEY, '{not json');
    renderPage();
    await waitFor(() => expect(triggers()).toEqual(['landing', 'initial']));
    expect(sessionStorage.getItem(HUB_STATE_KEY)).toBeNull();
  });

  it('유효하면 검색어·속성·geo·exactFor·데스크톱 page 를 그대로 복원하고 검색창에 검색어를 채운다', async () => {
    seedHubState({
      keyword: '경복궁', exactFor: '경복궁', category: null, attributes: ['parking'], sidoCode: null,
      geo: { lat: 37.57, lng: 126.97, radiusKm: 5 }, page: 2,
    });
    renderPage();
    await screen.findByText('관광지 21');
    await flush();

    expect(queries()[0]).toMatchObject({ keyword: '경복궁', exact: true, parking: 'YES', lat: 37.57, lng: 126.97, radiusKm: 5, page: 2 });
    expect(screen.getByLabelText(/^관광지 검색/)).toHaveValue('경복궁');
    expect(triggers()).toEqual(['restore']);
  });
});

describe('허브 상태 복원 — 모바일', () => {
  beforeEach(() => stubMedia(true));

  it.each(['/place', '/place?layout=mapSplit'])('%s — page 는 0 으로, 첫 쪽에 없는 선택만 버린다', async (path) => {
    seedHubState({ page: 2, selectedId: '21' });
    renderPage({ path });
    await screen.findByText('관광지 1');
    await flush();

    expect(queries()[0]).toMatchObject({ category: 'nature', sidoCode: '11', page: 0 });
    expect(fetchAttraction).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(triggers()).toEqual(['restore']);
  });

  it('첫 쪽에 있는 선택은 그대로 연다', async () => {
    seedHubState({ page: 2, selectedId: '2' });
    renderPage();
    await screen.findByText('관광지 1');

    await waitFor(() => expect(fetchAttraction).toHaveBeenCalledWith('2'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(queries()[0]).toMatchObject({ page: 0 });
  });
});
