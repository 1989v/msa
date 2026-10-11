import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdministrativeRegion, Attraction, AttractionQuery } from '../../../api/placeApi';
import type { FavoriteItem } from '../../../api/wishlistApi';
import type { EventAction, TrackedEvent } from '../../../analytics/events';

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
// tracker·FavoriteButton·useImpression 은 대역이 없다 — 실제 전송기가 같은 관광지의 세 CLICK 을
// 중복 키로 접지 않는지가 이 파일의 존재 이유다. 판정 근거는 전송기의 대기열과 beacon 본문이다.

import { fetchAdministrativeRegions, fetchAttraction, searchAttractions, suggestPlaces } from '../../../api/placeApi';
import { addFavorite, fetchFavoriteKeys, removeFavorite } from '../../../api/wishlistApi';
import { resetIdentityForTest } from '../../../analytics/identity';
import { pendingForTest, resetTrackerForTest } from '../../../analytics/tracker';
import PlacePage, { resetPlaceSessionForTest } from '../PlacePage';
import { DWELL_MS } from '../../../analytics/useImpression';
import { advance, installIntersectionObserver } from '../../../components/ads/__tests__/adsTestKit';
import { cardFacts } from '../placeAttributes';
import { todayKst } from '../../../seo/eventSchedule';

const seoul: AdministrativeRegion = {
  code: '11', parentCode: null, level: 'SIDO', name: '서울특별시', nameEn: 'Seoul', latitude: 37.56, longitude: 126.97, attractionCount: 4321,
};

const item = (id: string): Attraction => ({
  id, contentId: id, lang: 'ko', title: `관광지 ${id}`, category: 'nature', areaCode: null,
  address: null, latitude: 37.5, longitude: 127, imageUrl: null, tel: null, overview: null,
  distanceKm: null, position: 0,
});

/** 조건이 바뀌어도 같은 두 관광지를 준다 — ④ 가 다른 view 에서 같은 카드의 찜을 뒤집는다. */
function respond(q: AttractionQuery) {
  return Promise.resolve({
    searchId: 's', attractions: [item('a1'), item('a2')], totalElements: 2, totalPages: 1,
    currentPage: q.page ?? 0, attributeFacets: null,
  });
}

const favoriteItem = (targetKey: string): FavoriteItem => ({
  id: 1, targetType: 'ATTRACTION', targetKey, collectionId: null, createdAt: '2026-10-08T00:00:00Z',
});

/** 데스크톱 — 패널이 세 번째 열(complementary)로 열린다 */
function stubMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
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

/** 토큰은 HttpOnly 라 JS 가 못 본다 — 로그인 여부는 표시 쿠키로 본다 (ADR-0101) */
function setSession(memberId: string | null) {
  document.cookie = memberId
    ? `portal_user_id=${memberId}; Path=/`
    : 'portal_user_id=; Path=/; Max-Age=0';
}

type Batch = { events: TrackedEvent[]; visitorId?: string; sessionId?: string };

/** jsdom 의 Blob 에는 `text()` 가 없다 — FileReader 로 읽는다 */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('PlacePage 계측 — 실제 트래커', () => {
  /** 전송기가 fetch·beacon 으로 내보낸 본문 — `other` 게이트가 대기열과 함께 본다 */
  let sent: Batch[] = [];
  /** 서버의 찜 상태 — 토글 뒤 재조회가 바뀐 값을 돌려줘야 둘째 토글이 반대 방향이 된다 */
  let savedKeys = new Set<string>();

  const byAction = (action: EventAction) => pendingForTest().filter((e) => e.action === action);
  const favoriteClicks = () => byAction('CLICK').filter((e) => e.sectionId === 'FAVORITE');
  const triggers = () => byAction('SEARCH').map((e) => e.payload?.trigger);
  /** 자동 시도 선택(서울)까지 끝난 상태 — 그 view 의 SEARCH 가 `initial` 이다 */
  const untilInitial = () => waitFor(() => expect(triggers()).toEqual(['landing', 'initial']));
  const cardOf = (title: string) => screen.getByText(title).closest('a')!;

  beforeEach(() => {
    stubMedia();
    setSession('1');
    sessionStorage.clear();
    localStorage.clear();
    resetTrackerForTest();
    resetIdentityForTest();
    resetPlaceSessionForTest();
    sent = [];
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)) as Batch);
      return Promise.resolve(new Response(null, { status: 202 }));
    });
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
    vi.mocked(removeFavorite).mockImplementation((_type, key) => {
      savedKeys.delete(key);
      return Promise.resolve();
    });
  });
  afterEach(() => {
    const searches = [...pendingForTest(), ...sent.flatMap((b) => b.events)].filter((e) => e.action === 'SEARCH');
    cleanup();
    resetTrackerForTest();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    setSession(null);
    // 안전망 `other` 는 운영에서 조용히 분모에만 들어간다 — 여기서는 곧 ref 를 안 심은 핸들러다
    expect(searches.map((e) => e.payload?.trigger)).not.toContain('other');
  });

  /** 카드 선택 → 패널 지도 링크 → 패널 찜(성공) — ①·② 가 같은 흐름을 쓴다 */
  async function selectOpenMapAndSave() {
    renderPage();
    await untilInitial();
    fireEvent.click(cardOf('관광지 a1'));
    const panel = await screen.findByRole('complementary', { name: '관광지 a1' });
    fireEvent.click(within(panel).getByRole('link', { name: '구글맵에서 보기' }));
    fireEvent.click(within(panel).getByRole('button', { name: '관광지 찜' }));
    await waitFor(() => expect(byAction('CLICK')).toHaveLength(3));
    return byAction('CLICK');
  }

  it('① 같은 관광지의 카드 선택·지도 열기·찜은 섹션이 달라 셋 다 대기열에 남고, viewId 는 SEARCH 와 같다', async () => {
    const clicks = await selectOpenMapAndSave();

    expect(clicks.map((e) => e.sectionId)).toEqual(['ATTRACTION_LIST', 'MAP_LINK', 'FAVORITE']);
    expect(clicks.map((e) => e.entityId)).toEqual(['a1', 'a1', 'a1']);
    expect(clicks.map((e) => e.screenRef)).toEqual(['11', '11', '11']);
    expect(clicks[2].payload).toEqual({ saved: true });

    const [landing, initial] = byAction('SEARCH');
    expect(landing.payload).toMatchObject({ trigger: 'landing' });
    expect(initial.payload).toMatchObject({ trigger: 'initial', sido: '11' });
    expect(clicks.map((e) => e.viewId)).toEqual([initial.viewId, initial.viewId, initial.viewId]);

    expect(byAction('SESSION_START')).toHaveLength(1);
    expect(byAction('SESSION_START')[0]).toMatchObject({ entityType: 'PAGE', entityId: 'place-hub' });
    // 세션 1 + SEARCH 2 + CLICK 3 — 그 밖의 것(노출 등)은 없다
    expect(pendingForTest()).toHaveLength(6);
  });

  it('② 화면을 떠나면 beacon 본문에 세 CLICK 과 식별자가 실리고 대기열은 빈다', async () => {
    await selectOpenMapAndSave();
    const beacons: { url: string; body: Blob }[] = [];
    Object.defineProperty(navigator, 'sendBeacon', {
      value: vi.fn((url: string, body: Blob) => {
        beacons.push({ url, body });
        return true;
      }),
      configurable: true,
    });
    try {
      window.dispatchEvent(new Event('pagehide'));
    } finally {
      Reflect.deleteProperty(navigator, 'sendBeacon');
    }

    expect(beacons).toHaveLength(1);
    expect(beacons[0].url).toBe('/api/v1/events');
    expect(beacons[0].body.type).toBe('application/json');
    const body = JSON.parse(await readBlob(beacons[0].body)) as Batch;
    sent.push(body);

    const clicks = body.events.filter((e) => e.action === 'CLICK');
    expect(clicks.map((e) => e.sectionId)).toEqual(['ATTRACTION_LIST', 'MAP_LINK', 'FAVORITE']);
    expect(new Set(clicks.map((e) => e.viewId)).size).toBe(1);
    expect(body.events).toHaveLength(6);
    // beacon 은 헤더를 못 실어 식별자가 본문에 온다
    expect(body.visitorId).toEqual(expect.any(String));
    expect(body.sessionId).toEqual(expect.any(String));
    expect(pendingForTest()).toEqual([]);
  });

  it('③ 처음부터 찜된 채 「해제 → 찜」은 같은 view 라 FAVORITE 한 건(saved:false)만 남는다', async () => {
    savedKeys.add('a1');
    renderPage();
    await untilInitial();
    fireEvent.click(cardOf('관광지 a1'));
    const panel = await screen.findByRole('complementary', { name: '관광지 a1' });

    // 찜 키가 도착해 해제 버튼이 된 뒤에 누른다
    fireEvent.click(await within(panel).findByRole('button', { name: '관광지 찜 해제' }));
    await waitFor(() => expect(favoriteClicks()).toHaveLength(1));
    expect(removeFavorite).toHaveBeenCalledWith('ATTRACTION', 'a1');

    fireEvent.click(await within(panel).findByRole('button', { name: '관광지 찜' }));
    await waitFor(() => expect(addFavorite).toHaveBeenCalledWith('ATTRACTION', 'a1'));
    // 두 토글이 모두 정산됐다 — onSettled 가 키를 다시 읽는다(처음 1 + 토글마다 1)
    await waitFor(() => expect(fetchFavoriteKeys).toHaveBeenCalledTimes(3));

    const favs = favoriteClicks();
    expect(favs).toHaveLength(1);
    expect(favs[0].payload).toEqual({ saved: false });
  });

  it('④ 찜(saved:true) 뒤 조건을 바꿔 새 view 에서 해제(saved:false)하면 두 건이 다른 viewId 로 남는다', async () => {
    renderPage();
    await untilInitial();
    const [, initial] = byAction('SEARCH');

    fireEvent.click(within(cardOf('관광지 a1')).getByRole('button', { name: '관광지 찜' }));
    await waitFor(() => expect(favoriteClicks()).toHaveLength(1));
    expect(favoriteClicks()[0]).toMatchObject({ viewId: initial.viewId, payload: { saved: true } });

    // 속성 칩은 「필터」 다이얼로그 안 — 고른 뒤 닫고 카드로 돌아간다
    fireEvent.click(screen.getByRole('button', { name: /^필터/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '필터' })).getByRole('button', { name: /^주차 가능/ }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(triggers()).toEqual(['landing', 'initial', 'attribute']));
    const next = byAction('SEARCH')[2];
    expect(next.viewId).not.toBe(initial.viewId);

    // 같은 카드가 새 view 로 다시 그려졌다 — 찜된 상태라 해제 버튼이다
    fireEvent.click(await within(cardOf('관광지 a1')).findByRole('button', { name: '관광지 찜 해제' }));
    await waitFor(() => expect(favoriteClicks()).toHaveLength(2));

    const favs = favoriteClicks();
    expect(favs.map((e) => e.payload)).toEqual([{ saved: true }, { saved: false }]);
    expect(favs.map((e) => e.viewId)).toEqual([initial.viewId, next.viewId]);
    expect(favs.map((e) => e.entityId)).toEqual(['a1', 'a1']);
  });

  // 배지별 CTR 을 볼 수 있게 노출·클릭 둘 다 카드 상태 배지 code 를 싣는다 — 기대값은 대상 함수(cardFacts)가 낸 값이다
  it('⑤ 카드 노출·클릭 payload.badges = cardFacts 의 code 배열(빈 배열 포함), 기존 키·source 는 그대로', async () => {
    const rich: Attraction = {
      ...item('a1'), contentTypeId: '12', closureState: 'ALWAYS_OPEN', attrAdmission: 'FREE', petPolicy: 'ALLOWED', attrParking: 'YES',
    };
    vi.mocked(searchAttractions).mockImplementation((q) =>
      Promise.resolve({
        searchId: 's', attractions: [rich, item('a2')], totalElements: 2, totalPages: 1, currentPage: q.page ?? 0, attributeFacets: null,
      }),
    );
    const expected = cardFacts(rich, 'ko', todayKst()).badges.map((b) => b.code);
    expect(expected).toEqual(['alwaysOpen', 'free', 'pet']);

    const io = installIntersectionObserver();
    renderPage();
    await untilInitial();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      io.show(1);
      await advance(DWELL_MS);
      const imps = byAction('IMPRESSION');
      expect(imps.map((e) => [e.entityId, e.sectionId, e.itemIndex, e.payload])).toEqual([
        ['a1', 'ATTRACTION_LIST', 0, { badges: expected }],
        ['a2', 'ATTRACTION_LIST', 1, { badges: [] }],
      ]);

      fireEvent.click(cardOf('관광지 a1'));
      fireEvent.click(cardOf('관광지 a2'), { metaKey: true });
      const clicks = byAction('CLICK').filter((e) => e.sectionId === 'ATTRACTION_LIST');
      expect(clicks.map((e) => [e.entityId, e.itemIndex, e.payload])).toEqual([
        ['a1', 0, { source: 'card', badges: expected }],
        ['a2', 1, { source: 'card', newTab: true, badges: [] }],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});
