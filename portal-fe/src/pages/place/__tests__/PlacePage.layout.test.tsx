import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attraction, AttractionQuery } from '../../../api/placeApi';

vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  searchAttractions: vi.fn(),
  fetchAdministrativeRegions: vi.fn(),
  fetchAttraction: vi.fn(),
  suggestPlaces: vi.fn(),
}));
// 지도 로더만 바꾼다 — 키가 비면 지도 effect 가 키 검사에서 빠져 「미호출」이 저절로 통과하므로 키는 값을 준다
vi.mock('../googleMaps', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../googleMaps')>()),
  loadGoogleMaps: vi.fn(),
  mapsApiKey: vi.fn(),
}));
vi.mock('../../../components/favorite/FavoriteButton', () => ({
  default: () => <button data-testid="fav" />,
}));
vi.mock('../../../analytics/tracker', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../analytics/tracker')>()),
  track: vi.fn(),
}));

import { fetchAdministrativeRegions, searchAttractions, suggestPlaces } from '../../../api/placeApi';
import { track } from '../../../analytics/tracker';
import { loadGoogleMaps, mapsApiKey } from '../googleMaps';
import PlacePage, { resetPlaceSessionForTest } from '../PlacePage';

const MOBILE_QUERY = '(max-width: 899.98px)';

const item = (id: string): Attraction => ({
  id, contentId: id, lang: 'ko', title: `관광지 ${id}`, category: 'nature', areaCode: null,
  address: null, latitude: 37.5, longitude: 127, imageUrl: null, tel: null, overview: null,
  distanceKm: null, position: 0,
});

function respond(q: AttractionQuery) {
  const prefix = q.parking ? 'p' : 'a';
  return Promise.resolve({
    searchId: 's',
    attractions: [item(`${prefix}-1`), item(`${prefix}-2`), item(`${prefix}-3`)],
    totalElements: 3,
    totalPages: 1,
    currentPage: q.page ?? 0,
    attributeFacets: null,
  });
}

/*
 * matchMedia 대역 — 쿼리마다 mql 하나, 같은 쿼리에는 같은 객체(useMediaQuery 가 초기값과 effect 에서 두 번 부른다).
 * MOBILE_QUERY 만 mobile 값을 갖고, 폭 전환은 matches 를 바꾼 뒤 보관한 리스너를 부른다.
 */
type Mql = { matches: boolean; media: string; listeners: Set<() => void>; addEventListener: unknown; removeEventListener: unknown };
let mqls: Map<string, Mql>;
function stubMedia(mobile: boolean) {
  mqls = new Map();
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    let mql = mqls.get(query);
    if (!mql) {
      const listeners = new Set<() => void>();
      mql = {
        matches: query === MOBILE_QUERY ? mobile : false,
        media: query,
        listeners,
        addEventListener: (_: string, fn: () => void) => listeners.add(fn),
        removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
      };
      mqls.set(query, mql);
    }
    return mql;
  }) as unknown as typeof window.matchMedia;
}
function setMobile(mobile: boolean) {
  const mql = mqls.get(MOBILE_QUERY)!;
  mql.matches = mobile;
  act(() => mql.listeners.forEach((fn) => fn()));
}

class FakeMap {
  addListener() {
    return { remove() {} };
  }
  fitBounds() {}
  getZoom() {
    return 10;
  }
  setZoom() {}
  setCenter() {}
  getCenter() {
    return null;
  }
  getBounds() {
    return null;
  }
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
const loads = () => vi.mocked(loadGoogleMaps).mock.calls.length;
const body = () => document.querySelector('.place-body')!;
const listCol = () => document.querySelector('.place-list-col')!;
const mapToggle = () => screen.queryByRole('button', { name: /^(지도 보기|목록 보기)$/ });
const filterSheet = () => screen.queryByRole('dialog', { name: '필터' });
const openFilters = () => fireEvent.click(screen.getByRole('button', { name: /^필터( \d+)?$/ }));

beforeEach(() => {
  stubMedia(true);
  // 지도 상태로 들어갈 때 맨 위로 올린다 — jsdom 은 스크롤을 구현하지 않는다
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  sessionStorage.clear();
  resetPlaceSessionForTest();
  vi.mocked(mapsApiKey).mockReturnValue('test-key');
  vi.mocked(loadGoogleMaps).mockReset();
  vi.mocked(loadGoogleMaps).mockResolvedValue({ Map: FakeMap });
  vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
  vi.mocked(suggestPlaces).mockResolvedValue([]);
  vi.mocked(searchAttractions).mockReset();
  vi.mocked(searchAttractions).mockImplementation(respond);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('좁은 화면 listFirst (기본)', () => {
  it('목록이 먼저고 지도는 숨긴 채 마운트만 한다 — 「지도 보기」 전에는 지도 스크립트를 부르지 않는다', async () => {
    renderPage();
    await screen.findByText('관광지 a-1');

    expect(body()).toHaveClass('is-list-view');
    expect(document.querySelector('.place-map')).not.toBeNull();
    expect(mapToggle()).toHaveTextContent('지도 보기');
    expect(loads()).toBe(0);

    fireEvent.click(mapToggle()!);
    await waitFor(() => expect(loads()).toBe(1));
    expect(body()).toHaveClass('is-map-view');
    expect(mapToggle()).toHaveTextContent('목록 보기');
  });

  it('지도 상태의 결과는 같은 목록 칸에 패널 클래스를 단 것이다 — 카드는 하나씩만 있다', async () => {
    renderPage();
    await screen.findByText('관광지 a-1');
    fireEvent.click(mapToggle()!);

    expect(listCol()).toHaveClass('place-results-panel');
    expect(document.querySelectorAll('.place-list-col')).toHaveLength(1);
    const ids = Array.from(document.querySelectorAll('[id^=place-card-]')).map((el) => el.id);
    expect(ids).toEqual(['place-card-a-1', 'place-card-a-2', 'place-card-a-3']);

    fireEvent.click(mapToggle()!);
    expect(listCol()).not.toHaveClass('place-results-panel');
    expect(body()).toHaveClass('is-list-view');
  });

  it('전환 버튼은 바닥글 바로 앞 형제가 아니다 — 바닥글 앞 요소가 받는 여백이 고정 버튼을 띄우지 않게', async () => {
    renderPage();
    await screen.findByText('관광지 a-1');
    const beforeFooter = () => document.querySelector('.site-footer')!.previousElementSibling;

    expect(beforeFooter()).not.toBe(mapToggle());
    fireEvent.click(mapToggle()!);
    expect(mapToggle()).toHaveTextContent('목록 보기');
    expect(beforeFooter()).not.toBe(mapToggle());
  });

  it('지도 보기 → 목록 보기 → 지도 보기 왕복에도 지도 스크립트는 한 번, 질의·계측은 그대로', async () => {
    renderPage();
    await screen.findByText('관광지 a-1');
    await waitFor(() => expect(vi.mocked(track).mock.calls.some(([a]) => a === 'SEARCH')).toBe(true));
    const searches = calls().length;
    const tracked = vi.mocked(track).mock.calls.length;

    fireEvent.click(mapToggle()!);
    await waitFor(() => expect(loads()).toBe(1));
    fireEvent.click(mapToggle()!);
    fireEvent.click(mapToggle()!);
    await act(async () => {});

    expect(loads()).toBe(1);
    expect(calls()).toHaveLength(searches);
    expect(vi.mocked(track).mock.calls).toHaveLength(tracked);
  });

  it('지도 키가 없으면 전환 버튼을 그리지 않는다', async () => {
    vi.mocked(mapsApiKey).mockReturnValue('');
    renderPage();
    await screen.findByText('관광지 a-1');
    expect(mapToggle()).toBeNull();
  });

  it('필터 시트에서 꺼진 지도 오버레이 칩을 누르면 지도 상태로 가고 시트를 닫는다', async () => {
    renderPage();
    await screen.findByText('관광지 a-1');
    openFilters();
    const sheet = await screen.findByRole('dialog', { name: '필터' });

    fireEvent.click(within(sheet).getByRole('button', { name: '음식' }));
    expect(filterSheet()).toBeNull();
    expect(body()).toHaveClass('is-map-view');
    await waitFor(() => expect(loads()).toBe(1));
  });

  it('지도 상태에서 누르거나 오버레이를 끄는 클릭은 값만 바꾸고 시트를 열어 둔다', async () => {
    renderPage();
    await screen.findByText('관광지 a-1');
    fireEvent.click(mapToggle()!);
    openFilters();
    const sheet = await screen.findByRole('dialog', { name: '필터' });
    const food = within(sheet).getByRole('button', { name: '음식' });

    fireEvent.click(food);
    expect(filterSheet()).not.toBeNull();
    expect(food).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(food);
    expect(filterSheet()).not.toBeNull();
    expect(food).toHaveAttribute('aria-pressed', 'false');
  });

  it('지도 키가 없으면 오버레이 칩은 값만 바꾸고 목록 상태를 지킨다', async () => {
    vi.mocked(mapsApiKey).mockReturnValue('');
    renderPage();
    await screen.findByText('관광지 a-1');
    openFilters();
    const sheet = await screen.findByRole('dialog', { name: '필터' });
    const food = within(sheet).getByRole('button', { name: '음식' });

    fireEvent.click(food);
    expect(food).toHaveAttribute('aria-pressed', 'true');
    expect(body()).toHaveClass('is-list-view');
    expect(mapToggle()).toBeNull();
  });

  it('넓은 화면으로 갔다 돌아와도 지도 스크립트를 다시 부르지 않고 목록/지도 상태를 지킨다', async () => {
    renderPage();
    await screen.findByText('관광지 a-1');
    fireEvent.click(mapToggle()!);
    await waitFor(() => expect(loads()).toBe(1));

    setMobile(false);
    await act(async () => {});
    setMobile(true);
    await act(async () => {});

    expect(loads()).toBe(1);
    expect(body()).toHaveClass('is-map-view');
  });

  it('목록 상태에서 넓은 화면으로 가면 지도를 부르고, 좁아지면 목록 상태로 돌아온다', async () => {
    renderPage();
    await screen.findByText('관광지 a-1');
    expect(loads()).toBe(0);

    setMobile(false);
    await waitFor(() => expect(loads()).toBe(1));
    setMobile(true);
    await act(async () => {});

    expect(loads()).toBe(1);
    expect(body()).toHaveClass('is-list-view');
  });
});

describe('좁은 화면 mapSplit', () => {
  it('마운트 때 지도를 한 번 부르고 전환 버튼이 없다', async () => {
    renderPage('/place?layout=mapSplit');
    await screen.findByText('관광지 a-1');
    await waitFor(() => expect(loads()).toBe(1));
    expect(mapToggle()).toBeNull();
    expect(body()).toHaveClass('is-map-split');
  });

  it('변형이 달라도 목록 질의는 같다', async () => {
    renderPage('/place?layout=mapSplit');
    await screen.findByText('관광지 a-1');
    const split = calls()[0];
    cleanup();
    vi.mocked(searchAttractions).mockClear();

    renderPage('/place?layout=listFirst');
    await screen.findByText('관광지 a-1');
    expect(calls()[0]).toEqual(split);
  });

  it('layout 은 계측 screenRef·canonical 에 실리지 않는다', async () => {
    renderPage('/place?layout=mapSplit');
    await screen.findByText('관광지 a-1');
    await waitFor(() => expect(vi.mocked(track).mock.calls.length).toBeGreaterThan(0));

    for (const [, payload] of vi.mocked(track).mock.calls) {
      expect(JSON.stringify(payload)).not.toMatch(/layout|mapSplit/);
    }
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).not.toMatch(/layout/);
  });
});

describe('넓은 화면', () => {
  it('?layout 을 무시한다 — 마운트 때 지도, 전환 버튼·변형 클래스 없음', async () => {
    stubMedia(false);
    renderPage('/place?layout=listFirst');
    await screen.findByText('관광지 a-1');
    await waitFor(() => expect(loads()).toBe(1));
    expect(mapToggle()).toBeNull();
    expect(body()).not.toHaveClass('is-list-view');
    expect(body()).not.toHaveClass('is-map-view');
    expect(document.querySelector('.place-filter-bar')).toBeNull();
  });
});

describe('좁은 화면 필터 한 줄', () => {
  const summary = () => document.querySelector('.place-filter-summary');

  it('분류 칩은 전체·자연·행사 셋이고 나머지는 「필터」 시트에 있다', async () => {
    renderPage();
    await screen.findByText('관광지 a-1');
    const bar = document.querySelector('.place-filter-bar')!;
    expect(Array.from(bar.querySelectorAll('.place-chip')).map((b) => b.textContent)).toEqual(['전체', '자연', '행사']);
    expect(document.querySelector('.place-attr-chip')).toBeNull();
    expect(screen.getByRole('button', { name: '필터' })).toBeInTheDocument();
    expect(summary()).toBeNull();

    openFilters();
    const sheet = await screen.findByRole('dialog', { name: '필터' });
    expect(within(sheet).getByRole('button', { name: '역사' })).toBeInTheDocument();
    expect(sheet.querySelectorAll('.place-attr-chip').length).toBeGreaterThan(0);
  });

  it('「필터 N」과 요약 줄은 같은 조건 목록이다 — 분류·속성은 세고 검색어는 세지 않는다', async () => {
    renderPage();
    await screen.findByText('관광지 a-1');
    const bar = document.querySelector('.place-filter-bar')!;

    fireEvent.click(within(bar as HTMLElement).getByRole('button', { name: '자연' }));
    expect(screen.getByRole('button', { name: '필터 1' })).toBeInTheDocument();
    expect(summary()).toHaveTextContent('자연');

    openFilters();
    const sheet = await screen.findByRole('dialog', { name: '필터' });
    fireEvent.click(within(sheet).getByRole('button', { name: /^주차 가능/ }));
    expect(screen.getByRole('button', { name: '필터 2' })).toBeInTheDocument();
    expect(summary()!.textContent).toBe('자연 · 주차 가능');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '궁궐' } });
    fireEvent.click(screen.getByRole('button', { name: '검색' }));
    expect(screen.getByRole('button', { name: '필터 2' })).toBeInTheDocument();
  });

  it('시트 안 속성 칩은 기존과 같은 질의·계측을 내고, 누른 뒤 포커스가 그 칩에 남는다', async () => {
    renderPage();
    await screen.findByText('관광지 a-1');
    openFilters();
    const sheet = await screen.findByRole('dialog', { name: '필터' });
    const parking = within(sheet).getByRole('button', { name: /^주차 가능/ });

    parking.focus();
    fireEvent.click(parking);
    await screen.findByText('관광지 p-1');

    expect(calls().at(-1)).toMatchObject({ parking: 'YES', page: 0 });
    await waitFor(() => {
      const last = vi.mocked(track).mock.calls.filter(([a]) => a === 'SEARCH').at(-1)!;
      expect(last[1].payload).toMatchObject({ trigger: 'attribute', changed: ['attributes', 'page'] });
    });
    expect(document.activeElement).toBe(parking);
  });
});

describe('카드 사진 우선순위 · 랜드마크', () => {
  const TONG = 'https://tong.visitkorea.or.kr/cms/resource/';
  // 첫 카드는 사진이 없다 — eager 는 카드 순번이 아니라 사진 순번으로 센다
  beforeEach(() => {
    vi.mocked(searchAttractions).mockImplementation((q) =>
      Promise.resolve({
        searchId: 's',
        attractions: [
          item('n-0'),
          { ...item('n-1'), imageUrl: `${TONG}1.jpg` },
          { ...item('n-2'), thumbnailUrl: `${TONG}2-thumb.jpg`, imageUrl: `${TONG}2.jpg` },
          { ...item('n-3'), imageUrl: `${TONG}3.jpg` },
          { ...item('n-4'), imageUrl: `${TONG}4.jpg` },
        ],
        totalElements: 5,
        totalPages: 1,
        currentPage: q.page ?? 0,
        attributeFacets: null,
      }),
    );
  });

  for (const mobile of [true, false]) {
    it(`${mobile ? '좁은' : '넓은'} 화면 — 문서 전체 eager 는 사진 있는 앞 두 카드뿐이고 fetchpriority=high, 카드 사진은 전부 88×88`, async () => {
      stubMedia(mobile);
      renderPage();
      await screen.findByText('관광지 n-4');

      const eager = Array.from(document.querySelectorAll('img[loading="eager"]'));
      expect(eager).toHaveLength(2);
      expect(eager.map((img) => img.closest('a')?.id)).toEqual(['place-card-n-1', 'place-card-n-2']);
      for (const img of eager) expect(img).toHaveAttribute('fetchpriority', 'high');
      expect(document.querySelectorAll('img[fetchpriority]')).toHaveLength(2);

      const cardImgs = Array.from(document.querySelectorAll('img.place-card-img'));
      expect(cardImgs).toHaveLength(4);
      for (const img of cardImgs) {
        expect(img).toHaveAttribute('width', '88');
        expect(img).toHaveAttribute('height', '88');
      }
      for (const img of cardImgs.slice(2)) expect(img).toHaveAttribute('loading', 'lazy');
      expect(document.querySelector('#place-card-n-0 div.place-card-img-empty')).not.toBeNull();
    });

    it(`${mobile ? '좁은' : '넓은'} 화면 — <main> 은 하나이고 결과 본문을 품으며 바닥글은 밖이다`, async () => {
      stubMedia(mobile);
      renderPage();
      await screen.findByText('관광지 n-4');

      const mains = document.querySelectorAll('main');
      expect(mains).toHaveLength(1);
      expect(mains[0]).toHaveClass('place-body');
      expect(mains[0].querySelector('#place-card-n-1')).not.toBeNull();
      expect(mains[0].querySelector('footer')).toBeNull();
    });
  }
});
