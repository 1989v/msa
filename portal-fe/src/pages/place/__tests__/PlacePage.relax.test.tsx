import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdministrativeRegion, AttractionQuery, AttractionSearchResult } from '../../../api/placeApi';

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
import { advance } from '../../../components/ads/__tests__/adsTestKit';
import PlacePage, { resetPlaceSessionForTest } from '../PlacePage';

/*
 * 0건 화면의 조건 해제와 교정 안내. 판정 근거는 화면이 실제로 보낸 질의(`searchAttractions` 대역 인자),
 * 그려진 버튼, 계측 대역(`track`)이 받은 SEARCH payload 다.
 */

const seoul: AdministrativeRegion = {
  code: '11', parentCode: null, level: 'SIDO', name: '서울특별시', nameEn: 'Seoul', latitude: 37.56, longitude: 126.97, attractionCount: 4321,
};
const jongno: AdministrativeRegion = {
  code: '11110', parentCode: '11', level: 'SIGUNGU', name: '종로구', nameEn: 'Jongno-gu', latitude: 37.57, longitude: 126.98, attractionCount: 300,
};

const empty = (over: Partial<AttractionSearchResult> = {}): Promise<AttractionSearchResult> =>
  Promise.resolve({ searchId: 's', attractions: [], totalElements: 0, totalPages: 0, currentPage: 0, attributeFacets: null, ...over });

/**
 * gcTime 0 — 해제한 질의가 앞서 본 조건과 같아도 캐시에서 나오지 않고 다시 요청되게 한다.
 * 그래야 「해제 뒤 다음 질의」를 대역 인자로 볼 수 있다(화면은 쓰지 않는 질의를 바로 버린다).
 */
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
const relaxGroup = () => screen.getByRole('group', { name: '조건 해제' });
const relaxButtons = () => within(relaxGroup()).getAllByRole('button').map((b) => b.textContent);
const relaxButton = (name: RegExp | string) => within(relaxGroup()).getByRole('button', { name });

/** 자동 시도 선택(서울)까지 끝난 0건 화면 */
const untilSeoul = async () => {
  await waitFor(() => expect(lastCall()).toMatchObject({ sidoCode: '11' }));
  await screen.findByRole('group', { name: '조건 해제' });
};
const submitKeyword = (value: string, button = '검색') => {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: button }));
};
/** 지금 질의에 실린 속성 파라미터 */
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
  vi.mocked(fetchAdministrativeRegions).mockImplementation(({ level }) => Promise.resolve(level === 'SIDO' ? [seoul] : [jongno]));
  vi.mocked(suggestPlaces).mockResolvedValue([]);
  vi.mocked(searchAttractions).mockReset();
  vi.mocked(searchAttractions).mockImplementation(() => empty());
});
afterEach(() => {
  const seen = searches().map((p) => p.trigger);
  vi.useRealTimers();
  vi.clearAllMocks();
  cleanup();
  // 해제 핸들러가 trigger 를 안 심으면 안전망 `other` 로 떨어진다
  expect(seen).not.toContain('other');
});

describe('0건 — 조건 해제 버튼', () => {
  it('조건이 없으면 버튼 없이 이유 문장만', async () => {
    vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
    renderPage();
    await screen.findByText('검색 결과가 없습니다');
    expect(screen.getByText('이 범위에 등록된 관광지가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '조건 해제' })).toBeNull();
  });

  it('조건이 하나(자동 선택된 시도)면 버튼 하나, 「모두 해제」는 없다', async () => {
    renderPage();
    await untilSeoul();
    expect(relaxButtons()).toEqual(['지역 ‘서울특별시’ 해제']);
  });

  it('검색어만 걸면 기본 분류·자동 행사 상태(NOT_ENDED)는 버튼이 되지 않는다', async () => {
    renderPage();
    await untilSeoul();
    submitKeyword('궁궐');
    await waitFor(() => expect(lastCall()).toMatchObject({ keyword: '궁궐', eventStatus: 'NOT_ENDED' }));
    await waitFor(() => expect(relaxButtons()).toEqual(['검색어 ‘궁궐’ 해제', '지역 ‘서울특별시’ 해제', '모두 해제']));
  });

  it('조건 셋(시도·검색어·속성) → 버튼 셋 + 모두 해제, 속성 버튼은 그 속성만 푼 질의를 보낸다', async () => {
    renderPage();
    await untilSeoul();
    submitKeyword('궁궐');
    await waitFor(() => expect(lastCall()).toMatchObject({ keyword: '궁궐' }));
    fireEvent.click(screen.getByRole('button', { name: /^주차 가능/ }));
    await waitFor(() => expect(lastCall()).toMatchObject({ parking: 'YES' }));
    await waitFor(() =>
      expect(relaxButtons()).toEqual(['검색어 ‘궁궐’ 해제', '‘주차 가능’ 해제', '지역 ‘서울특별시’ 해제', '모두 해제']),
    );

    fireEvent.click(relaxButton('‘주차 가능’ 해제'));
    await waitFor(() => expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['attributes', 'page'] }));
    expect(lastCall()).toMatchObject({ keyword: '궁궐', sidoCode: '11', page: 0 });
    expect(attrParams(lastCall())).toEqual([]);
  });

  it('검색어 해제 — 질의에서 검색어가 빠지고 입력창이 빈 값, changed [keyword, page]', async () => {
    renderPage();
    await untilSeoul();
    submitKeyword('궁궐');
    await waitFor(() => expect(relaxButtons()).toContain('검색어 ‘궁궐’ 해제'));

    fireEvent.click(relaxButton('검색어 ‘궁궐’ 해제'));
    await waitFor(() => expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['keyword', 'page'] }));
    expect(lastCall().keyword).toBeUndefined();
    expect(lastCall()).toMatchObject({ sidoCode: '11' });
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('분류 해제 — 고른 분류만 버튼이 되고, 누르면 기본 분류로 돌아간다', async () => {
    renderPage();
    await untilSeoul();
    fireEvent.click(screen.getByRole('button', { name: '자연' }));
    await waitFor(() => expect(relaxButtons()).toContain('분류 ‘자연’ 해제'));

    fireEvent.click(relaxButton('분류 ‘자연’ 해제'));
    await waitFor(() =>
      expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['category', 'listEventStatus', 'page'] }),
    );
    expect(lastCall().category).toBe('nature,history,culture,leisure');
  });

  it('행사 상태 — 기본(NOT_ENDED)은 버튼이 아니고, 고른 상태만 버튼이 된다', async () => {
    renderPage();
    await untilSeoul();
    fireEvent.click(screen.getByRole('button', { name: '행사' }));
    await waitFor(() => expect(relaxButtons()).toEqual(['분류 ‘행사’ 해제', '지역 ‘서울특별시’ 해제', '모두 해제']));

    fireEvent.click(within(screen.getByRole('group', { name: '행사 상태' })).getByRole('button', { name: '이번 주말' }));
    await waitFor(() => expect(relaxButtons()).toContain('행사 상태 ‘이번 주말’ 해제'));
    fireEvent.click(relaxButton('행사 상태 ‘이번 주말’ 해제'));
    await waitFor(() => expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['listEventStatus', 'page'] }));
    expect(lastCall()).toMatchObject({ category: 'festival', eventStatus: 'NOT_ENDED' });
  });

  it('시군구 선택 + 0건 → 지역 버튼 하나, 누르면 시도만 남는다', async () => {
    renderPage();
    await untilSeoul();
    fireEvent.click(await screen.findByRole('button', { name: /^종로구/ }));
    await waitFor(() => expect(lastCall()).toMatchObject({ sidoCode: '11', sigunguCode: '110' }));
    await waitFor(() => expect(relaxButtons()).toEqual(['지역 ‘종로구’ 해제']));

    fireEvent.click(relaxButton('지역 ‘종로구’ 해제'));
    await waitFor(() => expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['sigunguCode', 'page'] }));
    expect(lastCall()).toMatchObject({ sidoCode: '11' });
    expect(lastCall().sigunguCode).toBeUndefined();
  });

  describe('반경', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: { getCurrentPosition: (ok: PositionCallback) => ok({ coords: { latitude: 37.5, longitude: 127 } } as GeolocationPosition) },
      });
    });
    afterEach(() => {
      Reflect.deleteProperty(navigator, 'geolocation');
    });

    /** 자동 선택은 좌표 → 가까운 시도(서울). 그 뒤 「내 주변」으로 반경 5km 를 건다 */
    const seoulWithRadius = async () => {
      renderPage();
      await untilSeoul();
      fireEvent.click(screen.getByRole('button', { name: '내 주변' }));
      await waitFor(() => expect(lastCall()).toMatchObject({ sidoCode: '11', radiusKm: 5 }));
      await waitFor(() => expect(relaxButtons()).toEqual(['지역 ‘서울특별시’ 해제', '반경 5km 해제', '모두 해제']));
    };

    it('시도 + 반경에서 지역 해제 — 반경은 남고 시도만 빠진다', async () => {
      await seoulWithRadius();
      fireEvent.click(relaxButton('지역 ‘서울특별시’ 해제'));
      await waitFor(() =>
        expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['sidoCode', 'sigunguCode', 'areaCode', 'page'] }),
      );
      expect(lastCall()).toMatchObject({ lat: 37.5, lng: 127, radiusKm: 5 });
      expect(lastCall().sidoCode).toBeUndefined();
    });

    it('반경 해제 — 다음 질의에 좌표가 없다', async () => {
      await seoulWithRadius();
      fireEvent.click(relaxButton('반경 5km 해제'));
      await waitFor(() => expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['geo', 'page'] }));
      expect(lastCall().lat).toBeUndefined();
      expect(lastCall().lng).toBeUndefined();
      expect(lastCall()).toMatchObject({ sidoCode: '11' });
    });
  });

  it('시도만 있을 때 시도를 풀면 지역 고르기 화면으로 바뀐다', async () => {
    renderPage();
    await untilSeoul();
    fireEvent.click(relaxButton('지역 ‘서울특별시’ 해제'));
    expect(await screen.findByRole('heading', { name: '어느 지역부터 볼까요?' })).toBeInTheDocument();
    await waitFor(() => expect(lastSearch()).toMatchObject({ trigger: 'relax' }));
    expect(lastCall().sidoCode).toBeUndefined();
  });

  it('지역 축이 없을 때의 광역(areaCode) 해제 — changed [areaCode, page]', async () => {
    vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
    renderPage();
    await screen.findByText('검색 결과가 없습니다');
    fireEvent.change(screen.getByLabelText('Area'), { target: { value: '6' } });
    await waitFor(() => expect(lastCall()).toMatchObject({ areaCode: '6' }));
    await waitFor(() => expect(relaxButtons()).toEqual(['지역 ‘부산’ 해제']));

    fireEvent.click(relaxButton('지역 ‘부산’ 해제'));
    await waitFor(() => expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['areaCode', 'page'] }));
    expect(lastCall().areaCode).toBeUndefined();
  });

  it('「모두 해제」(검색어·속성·시군구) — 검색어·속성이 빠지고 시도만 남는다, 입력창 빈 값', async () => {
    renderPage();
    await untilSeoul();
    fireEvent.click(await screen.findByRole('button', { name: /^종로구/ }));
    await waitFor(() => expect(lastCall()).toMatchObject({ sigunguCode: '110' }));
    submitKeyword('궁궐');
    fireEvent.click(screen.getByRole('button', { name: /^주차 가능/ }));
    await waitFor(() => expect(relaxButtons()).toEqual(['검색어 ‘궁궐’ 해제', '‘주차 가능’ 해제', '지역 ‘종로구’ 해제', '모두 해제']));

    fireEvent.click(relaxButton('모두 해제'));
    await waitFor(() => expect(lastSearch()).toMatchObject({ trigger: 'relax' }));
    expect(lastSearch().changed).toEqual(['keyword', 'attributes', 'sigunguCode', 'page']);
    expect(lastCall().keyword).toBeUndefined();
    expect(attrParams(lastCall())).toEqual([]);
    expect(lastCall()).toMatchObject({ sidoCode: '11' });
    expect(lastCall().sigunguCode).toBeUndefined();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  describe('행사 분류 + 질의에 안 실린 속성 + 검색어', () => {
    /** 지역 축 없음 — 버튼이 검색어·분류 둘만 남게 */
    const setup = async () => {
      vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
      renderPage();
      await screen.findByText('검색 결과가 없습니다');
      fireEvent.click(screen.getByRole('button', { name: /^주차 가능/ }));
      await waitFor(() => expect(lastCall()).toMatchObject({ parking: 'YES' }));
      submitKeyword('불꽃');
      await waitFor(() => expect(lastCall()).toMatchObject({ keyword: '불꽃' }));
      fireEvent.click(screen.getByRole('button', { name: '행사' }));
      await waitFor(() => expect(lastCall()).toMatchObject({ category: 'festival' }));
      expect(lastCall().parking).toBeUndefined();
      await waitFor(() => expect(relaxButtons()).toEqual(['검색어 ‘불꽃’ 해제', '분류 ‘행사’ 해제', '모두 해제']));
    };

    it('「모두 해제」는 숨은 속성까지 비운다', async () => {
      await setup();
      fireEvent.click(relaxButton('모두 해제'));
      await waitFor(() => expect(lastSearch()).toMatchObject({ trigger: 'relax' }));
      expect(lastSearch().changed).toEqual(expect.arrayContaining(['attributes', 'listEventStatus']));
      expect(attrParams(lastCall())).toEqual([]);
      expect(lastCall().keyword).toBeUndefined();
      expect(lastCall().category).toBe('nature,history,culture,leisure');
    });

    it('분류 버튼만 누르면 남아 있던 속성이 다시 질의에 실린다', async () => {
      await setup();
      fireEvent.click(relaxButton('분류 ‘행사’ 해제'));
      await waitFor(() =>
        expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['category', 'listEventStatus', 'page'] }),
      );
      expect(lastCall()).toMatchObject({ keyword: '불꽃', parking: 'YES' });
      expect(screen.getByRole('button', { name: /^주차 가능/ })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('시도 목록이 늦게 와도 — 검색어만 건 0건에서 검색어를 풀면 지역 고르기 화면, 시도를 자동으로 고르지 않는다', async () => {
    let resolveSido: (r: AdministrativeRegion[]) => void = () => {};
    vi.mocked(fetchAdministrativeRegions).mockImplementation(({ level }) =>
      level === 'SIDO' ? new Promise((resolve) => { resolveSido = resolve; }) : Promise.resolve([jongno]),
    );
    renderPage();
    await waitFor(() => expect(calls()).toHaveLength(1));
    submitKeyword('궁궐');
    await waitFor(() => expect(relaxButtons()).toEqual(['검색어 ‘궁궐’ 해제']));
    resolveSido([seoul]);
    expect(await screen.findAllByRole('button', { name: /서울특별시/ })).not.toHaveLength(0);

    fireEvent.click(relaxButton('검색어 ‘궁궐’ 해제'));
    expect(await screen.findByRole('heading', { name: '어느 지역부터 볼까요?' })).toBeInTheDocument();
    await waitFor(() => expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['keyword', 'page'] }));
    expect(lastCall().sidoCode).toBeUndefined();
    expect(searches().map((p) => p.trigger)).not.toContain('initial');
  });

  it('오류면 실패 문구만 — 해제 버튼이 없다', async () => {
    vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
    vi.mocked(searchAttractions).mockRejectedValue(new Error('down'));
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    renderPage();
    for (const ms of [0, 1000, 2000, 4000, 1]) await advance(ms);
    expect(screen.getByText('목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '조건 해제' })).toBeNull();
  });
});

describe('교정 안내 · 원래 검색어로 검색', () => {
  beforeEach(() => {
    vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
    // 원래 검색어 검색(exact)이 아니면 서버가 고친 검색어를 알린다
    vi.mocked(searchAttractions).mockImplementation((q) =>
      empty({ correctedKeyword: q.keyword && !q.exact ? '경복궁' : null }),
    );
  });

  it('교정 + 0건이면 안내와 원래 검색어 버튼, 누르면 exact 질의 · changed [exact, page]', async () => {
    renderPage();
    await screen.findByText('검색 결과가 없습니다');
    submitKeyword('경복궁ㅇ');
    expect(await screen.findByText('‘경복궁’(으)로 검색한 결과입니다')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '원래 검색어 ‘경복궁ㅇ’(으)로 검색' }));
    await waitFor(() => expect(lastCall()).toMatchObject({ keyword: '경복궁ㅇ', exact: true, page: 0 }));
    await waitFor(() => expect(lastSearch()).toMatchObject({ trigger: 'relax', changed: ['exact', 'page'] }));
    expect(screen.queryByText('‘경복궁’(으)로 검색한 결과입니다')).toBeNull();
  });

  it('검색어를 바꾸면 질의에서 exact 가 빠진다', async () => {
    renderPage();
    await screen.findByText('검색 결과가 없습니다');
    submitKeyword('경복궁ㅇ');
    fireEvent.click(await screen.findByRole('button', { name: '원래 검색어 ‘경복궁ㅇ’(으)로 검색' }));
    await waitFor(() => expect(lastCall()).toMatchObject({ exact: true }));

    submitKeyword('창덕궁');
    await waitFor(() => expect(lastCall()).toMatchObject({ keyword: '창덕궁' }));
    expect(lastCall().exact).toBeFalsy();
  });

  it('영문 화면 문구', async () => {
    renderPage('/en/place');
    await screen.findByText('No results found');
    expect(screen.getByText('No attractions are listed in this range.')).toBeInTheDocument();
    submitKeyword('palce', 'Search');
    expect(await screen.findByText('Showing results for “경복궁”')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search for “palce” instead' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Remove filters' });
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Remove keyword “palce”']);
  });
});
