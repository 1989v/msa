import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attraction, AttractionQuery, AttractionSearchResult, InterpretedCondition } from '../../../api/placeApi';

vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  searchAttractions: vi.fn(),
  fetchAdministrativeRegions: vi.fn(),
  fetchAttraction: vi.fn(),
  suggestPlaces: vi.fn(),
}));
vi.mock('../../../components/favorite/FavoriteButton', () => ({ default: () => null }));
vi.mock('../../../analytics/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../analytics/tracker')>()),
  track: vi.fn(),
}));

import { fetchAdministrativeRegions, searchAttractions, suggestPlaces } from '../../../api/placeApi';
import { track } from '../../../analytics/tracker';
import PlacePage, { resetPlaceSessionForTest } from '../PlacePage';

/*
 * 조건어 해석의 표시와 해제. 판정 근거는 화면이 실제로 보낸 질의(`searchAttractions` 대역 인자),
 * 그려진 칩·안내 줄, 계측 대역(`track`)이 받은 SEARCH payload 다. 해석 조건은 대역 응답이 정한다 —
 * 서버처럼 `keepConditionWords`·`skipCondition` 을 보고 해석을 뺀다.
 */

const PARKING: InterpretedCondition = { param: 'parking', value: 'YES', phrase: '주차 되는' };
const PET: InterpretedCondition = { param: 'pet', value: 'ALLOWED,PARTIAL', phrase: '반려견 동반' };

/** 검색어별 서버 해석 — 대역 응답이 쓴다 */
let interpretations: Record<string, InterpretedCondition[]> = {};
let zeroReason: (q: AttractionQuery) => AttractionSearchResult['zeroReason'] = () => null;
let corrected: (q: AttractionQuery) => string | null = () => null;
let hits = 0;

const respond = (q: AttractionQuery): Promise<AttractionSearchResult> => {
  const interpreted = q.keepConditionWords
    ? []
    : (interpretations[q.keyword ?? ''] ?? []).filter((c) => !(q.skipCondition ?? []).includes(c.param));
  const attractions: Attraction[] = Array.from({ length: hits }, (_, i) => ({
    id: String(i + 1), contentId: String(i + 1), lang: q.lang, title: `관광지 ${i + 1}`, category: 'nature', areaCode: null,
    address: null, latitude: 37.5, longitude: 127, imageUrl: null, tel: null, overview: null, distanceKm: null, position: i,
  }));
  return Promise.resolve({
    searchId: 's',
    attractions,
    totalElements: hits,
    totalPages: hits > 0 ? 1 : 0,
    currentPage: 0,
    attributeFacets: null,
    correctedKeyword: corrected(q),
    interpretedConditions: interpreted,
    zeroReason: zeroReason(q),
  });
};

function renderPage(path = '/place') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <PlacePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const calls = () => vi.mocked(searchAttractions).mock.calls.map(([q]) => q);
const lastCall = () => calls().at(-1)!;
const searches = () => vi.mocked(track).mock.calls.filter(([a]) => a === 'SEARCH').map(([, i]) => i.payload as Record<string, unknown>);
const lastSearch = () => searches().at(-1)!;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const submitKeyword = (value: string, button = '검색') => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: button }));
};
const openFilters = (name = '필터') => {
  const open = screen.queryByRole('dialog', { name });
  if (open) return open;
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
  return screen.getByRole('dialog', { name });
};
const closeFilters = () => fireEvent.keyDown(document, { key: 'Escape' });
const chip = (name: RegExp) => within(openFilters()).getByRole('button', { name });
const notice = () => document.querySelector('.place-interpreted');
const attrParams = (q: AttractionQuery) =>
  (['openToday', 'parking', 'creditCard', 'strollerRental', 'pet', 'admission', 'barrierFree', 'wellness'] as const).filter(
    (k) => q[k] != null,
  );

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  sessionStorage.clear();
  resetPlaceSessionForTest();
  interpretations = { '주차 되는 해수욕장': [PARKING], '주차 되는 반려견 동반 해수욕장': [PARKING, PET] };
  zeroReason = () => null;
  corrected = () => null;
  hits = 3;
  // 시도 목록이 없으면 자동 시도 선택이 돌지 않는다 — 질의 수를 검색어 제출로만 센다
  vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
  vi.mocked(suggestPlaces).mockResolvedValue([]);
  vi.mocked(searchAttractions).mockReset();
  vi.mocked(searchAttractions).mockImplementation(respond);
});
afterEach(() => {
  const seen = searches().map((p) => p.trigger);
  vi.clearAllMocks();
  cleanup();
  expect(seen).not.toContain('other');
});

/** 첫 화면 → 검색어 제출 → 해석이 실린 응답까지 */
const searchFor = async (keyword: string) => {
  renderPage();
  await waitFor(() => expect(calls()).toHaveLength(1));
  submitKeyword(keyword);
  await waitFor(() => expect(lastCall()).toMatchObject({ keyword }));
};

describe('해석 표시', () => {
  it('해석 조건 → 주차 칩이 켜지고 안내 줄이 뜬다. 추가 요청은 없다', async () => {
    await searchFor('주차 되는 해수욕장');
    await waitFor(() => expect(notice()).not.toBeNull());
    const before = calls().length;
    await flush();
    await flush();

    expect(calls()).toHaveLength(before);
    // 해석은 표시 상태다 — 다음 질의 파라미터로 옮겨 싣지 않는다
    expect(attrParams(lastCall())).toEqual([]);
    expect(notice()!.textContent).toContain('‘주차 되는’을 주차 가능 조건으로 읽었습니다. 정보가 있는 곳만 거릅니다');
    expect(chip(/^주차 가능/)).toHaveAttribute('aria-pressed', 'true');
    closeFilters();
  });

  it('조건 둘 — 원문과 칩 이름을 각각 · 로 잇고, PET 은 두 칩을 켜되 안내 줄에는 「반려동물 동반」 하나', async () => {
    await searchFor('주차 되는 반려견 동반 해수욕장');
    await waitFor(() => expect(notice()).not.toBeNull());

    expect(notice()!.textContent).toContain(
      '‘주차 되는’·‘반려견 동반’을 주차 가능·반려동물 동반 조건으로 읽었습니다. 정보가 있는 곳만 거릅니다',
    );
    expect(notice()!.textContent).not.toContain('반려동물 일부 구역');
    expect(chip(/^반려동물 동반/)).toHaveAttribute('aria-pressed', 'true');
    expect(chip(/^반려동물 일부 구역/)).toHaveAttribute('aria-pressed', 'true');
    closeFilters();
  });

  it('원문(phrase)은 텍스트로만 들어간다 — 마크업이 요소가 되지 않는다', async () => {
    interpretations['<b>x</b> 주차'] = [{ param: 'parking', value: 'YES', phrase: '<b>x</b>' }];
    await searchFor('<b>x</b> 주차');
    await waitFor(() => expect(notice()).not.toBeNull());

    expect(notice()!.textContent).toContain('‘<b>x</b>’');
    expect(notice()!.querySelector('b')).toBeNull();
  });

  it('오타 교정 안내와 함께 뜨면 교정 줄이 먼저, 링크 문구가 서로 다르고 각자 자기 줄 끝에 있다', async () => {
    corrected = (q) => (q.keyword && !q.exact ? '주차 되는 해수욕장' : null);
    interpretations['주차 되는 해수욕쟝'] = [PARKING];
    await searchFor('주차 되는 해수욕쟝');
    await waitFor(() => expect(notice()).not.toBeNull());

    const correctedLine = document.querySelector('.place-corrected:not(.place-interpreted)')!;
    expect(correctedLine.compareDocumentPosition(notice()!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(correctedLine.lastElementChild?.textContent).toBe('원래 검색어 ‘주차 되는 해수욕쟝’(으)로 검색');
    expect(notice()!.lastElementChild?.textContent).toBe('조건으로 읽지 않고 검색');
  });

  it('영문 — 칩 이름과 ATTRIBUTE_CAPTION 영문을 쓴다', async () => {
    interpretations['parking available beach'] = [{ param: 'parking', value: 'YES', phrase: 'parking available' }];
    renderPage('/en/place');
    await waitFor(() => expect(calls()).toHaveLength(1));
    submitKeyword('parking available beach', 'Search');
    await waitFor(() => expect(notice()).not.toBeNull());

    expect(notice()!.textContent).toContain(
      'Read ‘parking available’ as Parking. Filters only places that list this information',
    );
    expect(within(notice() as HTMLElement).getByRole('button').textContent).toBe('Search words as typed');
  });
});

describe('해석 해제', () => {
  it('해석된 칩을 끄면 다음 질의에 skipCondition=parking — 다른 해석은 파라미터로 옮기지 않는다 · trigger relax', async () => {
    await searchFor('주차 되는 반려견 동반 해수욕장');
    await waitFor(() => expect(notice()).not.toBeNull());

    fireEvent.click(chip(/^주차 가능/));
    await waitFor(() => expect(lastCall()).toMatchObject({ skipCondition: ['parking'], page: 0 }));
    expect(attrParams(lastCall())).toEqual([]);
    expect(lastCall().keepConditionWords).toBeUndefined();
    await waitFor(() =>
      expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['skipCondition', 'attributes', 'page'] }),
    );
    // 남은 해석(PET)은 여전히 해석으로 켜져 있고, 주차 칩은 꺼졌다
    await waitFor(() => expect(chip(/^주차 가능/)).toHaveAttribute('aria-pressed', 'false'));
    expect(chip(/^반려동물 동반/)).toHaveAttribute('aria-pressed', 'true');
    closeFilters();
  });

  it('「조건으로 읽지 않고 검색」 → keepConditionWords=true · trigger relax', async () => {
    await searchFor('주차 되는 해수욕장');
    await waitFor(() => expect(notice()).not.toBeNull());

    fireEvent.click(within(notice() as HTMLElement).getByRole('button', { name: '조건으로 읽지 않고 검색' }));
    await waitFor(() => expect(lastCall()).toMatchObject({ keepConditionWords: true, page: 0 }));
    await waitFor(() =>
      expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['keepConditionWords', 'attributes', 'page'] }),
    );
    await waitFor(() => expect(notice()).toBeNull());
  });

  it('검색어를 바꾸면 keepConditionWords·skipCondition 이 질의에서 빠진다', async () => {
    await searchFor('주차 되는 반려견 동반 해수욕장');
    await waitFor(() => expect(notice()).not.toBeNull());
    fireEvent.click(chip(/^주차 가능/));
    await waitFor(() => expect(lastCall()).toMatchObject({ skipCondition: ['parking'] }));
    closeFilters();
    await waitFor(() => expect(notice()).not.toBeNull());
    fireEvent.click(within(notice() as HTMLElement).getByRole('button', { name: '조건으로 읽지 않고 검색' }));
    await waitFor(() => expect(lastCall()).toMatchObject({ keepConditionWords: true }));

    submitKeyword('주차 되는 해수욕장');
    await waitFor(() => expect(lastCall()).toMatchObject({ keyword: '주차 되는 해수욕장' }));
    expect(lastCall().keepConditionWords).toBeUndefined();
    expect(lastCall().skipCondition).toBeUndefined();
  });
});

describe('0건 화면', () => {
  beforeEach(() => {
    hits = 0;
  });
  const relaxButtons = () =>
    within(screen.getByRole('group', { name: '조건 해제' })).getAllByRole('button').map((b) => b.textContent);

  it('해석 조건도 해제 후보로 나오고, 검색어 버튼 이름은 「검색어 빼고 보기」 — 해석 버튼은 skipCondition 을 싣는다', async () => {
    await searchFor('주차 되는 해수욕장');
    await waitFor(() => expect(relaxButtons()).toEqual(['검색어 빼고 보기', '‘주차 가능’ 해제', '모두 해제']));

    fireEvent.click(screen.getByRole('button', { name: '‘주차 가능’ 해제' }));
    await waitFor(() => expect(lastCall()).toMatchObject({ keyword: '주차 되는 해수욕장', skipCondition: ['parking'] }));
    expect(attrParams(lastCall())).toEqual([]);
    await waitFor(() =>
      expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['skipCondition', 'attributes', 'page'] }),
    );
  });

  it.each([['NO_EVIDENCE'], ['NO_CONTENT']] as const)('zeroReason=%s → 조건 탓 문구 대신 대상 없음 문구(ko)', async (reason) => {
    zeroReason = () => reason;
    await searchFor('에펠탑');
    expect(await screen.findByText('찾는 대상이 등록된 관광지 정보에 없습니다. 다른 검색어로 찾아보세요.')).toBeInTheDocument();
    expect(screen.queryByText(/고른 조건을 모두 만족하는 관광지가 없습니다/)).toBeNull();
  });

  it('zeroReason 이 없으면 지금 문구 그대로', async () => {
    await searchFor('주차 되는 해수욕장');
    expect(await screen.findByText(/고른 조건을 모두 만족하는 관광지가 없습니다/)).toBeInTheDocument();
    expect(screen.queryByText(/찾는 대상이 등록된 관광지 정보에 없습니다/)).toBeNull();
  });

  it('영문 대상 없음 문구', async () => {
    zeroReason = () => 'NO_EVIDENCE';
    renderPage('/en/place');
    await waitFor(() => expect(calls()).toHaveLength(1));
    submitKeyword('eiffel tower', 'Search');
    expect(
      await screen.findByText('Nothing in our attraction listings matches what you searched for. Try a different search term.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No attractions match all the selected filters/)).toBeNull();
    expect(
      within(screen.getByRole('group', { name: 'Remove filters' })).getAllByRole('button').map((b) => b.textContent),
    ).toEqual(['Show without the keyword']);
  });

  it('exact + NO_EVIDENCE → 직전 교정어로 다시 검색하는 링크. 누르면 exact 가 빠진다', async () => {
    corrected = (q) => (q.keyword && !q.exact ? '경복궁' : null);
    zeroReason = (q) => (q.exact ? 'NO_EVIDENCE' : null);
    await searchFor('경복굼');
    fireEvent.click(await screen.findByRole('button', { name: '원래 검색어 ‘경복굼’(으)로 검색' }));
    await waitFor(() => expect(lastCall()).toMatchObject({ exact: true }));

    fireEvent.click(await screen.findByRole('button', { name: '교정한 검색어 ‘경복궁’(으)로 검색' }));
    await waitFor(() => expect(lastCall()).toMatchObject({ keyword: '경복굼', page: 0 }));
    expect(lastCall().exact).toBeUndefined();
    await waitFor(() => expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['exact', 'page'] }));
  });
});
