import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attraction } from '../../../api/placeApi';

vi.mock('../../../api/placeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/placeApi')>()),
  searchAttractions: vi.fn(),
  fetchAttractionNearby: vi.fn(),
  fetchAttraction: vi.fn(),
  fetchWeather: vi.fn(),
  fetchAirQuality: vi.fn(),
  fetchAdministrativeRegions: vi.fn(),
  suggestPlaces: vi.fn(),
}));
vi.mock('../../../components/ads/AdSlot', () => ({ default: () => null }));
// wishlistApi 만 대역이다 — FavoriteButton·tracker 는 진짜라 두 별의 동기와 전송 대기열을 대상의 값으로 본다
vi.mock('../../../api/wishlistApi', () => ({
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  fetchFavoriteKeys: vi.fn(),
  fetchFavorites: vi.fn(),
}));

import {
  fetchAdministrativeRegions,
  fetchAirQuality,
  fetchAttraction,
  fetchAttractionNearby,
  fetchWeather,
  searchAttractions,
  suggestPlaces,
} from '../../../api/placeApi';
import { addFavorite, fetchFavoriteKeys } from '../../../api/wishlistApi';
import { resetIdentityForTest } from '../../../analytics/identity';
import { pendingForTest, resetTrackerForTest } from '../../../analytics/tracker';
import AttractionPage from '../AttractionPage';
import PlacePage, { resetPlaceSessionForTest } from '../PlacePage';
import { googleMapsDirectionsUrl } from '../googleMaps';

/* 화면 폭 — max-width·min-width 질의를 폭 변수로 계산한다(그 밖의 질의는 false) */
let width = 390;
function stubMedia() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    const max = /max-width:\s*([\d.]+)px/.exec(query);
    const min = /min-width:\s*([\d.]+)px/.exec(query);
    const matches = (max != null || min != null) && (!max || width <= Number(max[1])) && (!min || width >= Number(min[1]));
    return { matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  }) as unknown as typeof window.matchMedia;
}

/* IntersectionObserver — 생성 인자(rootMargin)와 관찰 대상을 남기고, 대상별로 항목을 흘려 넣는다 */
type IO = { callback: IntersectionObserverCallback; options?: IntersectionObserverInit; targets: Element[] };
let observers: IO[] = [];
function installIO() {
  observers = [];
  class FakeIO {
    private entry: IO;
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.entry = { callback, options, targets: [] };
      observers.push(this.entry);
    }
    observe(t: Element) { this.entry.targets.push(t); }
    unobserve() {}
    disconnect() { this.entry.targets = []; }
    takeRecords() { return []; }
  }
  vi.stubGlobal('IntersectionObserver', FakeIO);
}
const actionsObserver = () => observers.find((o) => o.targets.some((t) => t.classList.contains('place-detail-actions')));
function reportActions(isIntersecting: boolean, bottom: number, rootTop = 60) {
  const o = actionsObserver()!;
  const target = o.targets.find((t) => t.classList.contains('place-detail-actions'))!;
  act(() => {
    o.callback(
      [{ target, isIntersecting, boundingClientRect: { bottom }, rootBounds: { top: rootTop } } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
  });
}

const HEADER_H = 60;
function stubHeaderHeight() {
  const real = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.classList.contains('place-header')) return { top: 0, bottom: HEADER_H, height: HEADER_H, left: 0, right: 390, width: 390, x: 0, y: 0, toJSON() {} } as DOMRect;
    return real.call(this);
  });
}

const base: Attraction = {
  id: '100', contentId: '100', lang: 'ko', title: '경복궁', category: 'history', areaCode: null,
  address: '서울특별시 종로구 사직로 161', latitude: 37.5788, longitude: 126.977, imageUrl: null,
  tel: '02-3700-3900', overview: '조선의 법궁이다.', distanceKm: null, position: 0,
  sidoCode: '11', contentTypeId: '12', closureState: 'WEEKLY', closedWeekdays: ['TUE'], attrParking: 'YES',
  attrAdmission: 'PAID', useTime: '09:00~18:00',
  access: {
    stops: [{ kind: 'RAIL', rank: 1, name: '경복궁역', nameEn: null, lines: '3호선', distanceM: 400, baseDate: '2026-10-01' }],
    busCovered: true,
  },
};

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="loc">{`${loc.pathname}${loc.search}${loc.hash}`}</output>;
}

function renderAt(path = '/attractions/100') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/attractions/:id" element={<><AttractionPage /><LocationProbe /></>} />
          <Route path="/place" element={<PlacePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const bar = () => document.querySelector<HTMLElement>('.place-action-bar');
const clicks = () => pendingForTest().filter((e) => e.action === 'CLICK');

beforeEach(() => {
  width = 390;
  stubMedia();
  installIO();
  stubHeaderHeight();
  document.cookie = 'portal_user_id=1; Path=/';
  sessionStorage.clear();
  localStorage.clear();
  resetTrackerForTest();
  resetIdentityForTest();
  resetPlaceSessionForTest();
  vi.stubGlobal('fetch', () => Promise.resolve(new Response(null, { status: 202 })));
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(fetchAttraction).mockResolvedValue(base);
  vi.mocked(fetchAttractionNearby).mockResolvedValue({ sights: [], stays: [], events: [], amenities: [] } as never);
  vi.mocked(fetchWeather).mockResolvedValue({ sigunguCode: '11110', shortBaseAt: null, midTmFc: null, days: [] });
  vi.mocked(fetchAirQuality).mockResolvedValue({ sigunguCode: '11110', stations: [] });
  // 서버의 찜 상태 — 토글 뒤 재조회가 바뀐 값을 돌려줘야 한다
  const savedKeys = new Set<string>();
  vi.mocked(fetchFavoriteKeys).mockImplementation(() => Promise.resolve([...savedKeys]));
  vi.mocked(addFavorite).mockImplementation((_t, key) => {
    savedKeys.add(key);
    return Promise.resolve({ id: 1, targetType: 'ATTRACTION', targetKey: key, collectionId: null, createdAt: '2026-10-11T00:00:00Z' });
  });
});
afterEach(() => {
  cleanup();
  resetTrackerForTest();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  document.cookie = 'portal_user_id=; Path=/; Max-Age=0';
  delete (navigator as { share?: unknown }).share;
});

describe('하단 행동 바 — 표시 조건 (≤640px)', () => {
  it('IO 콜백 전에는 hidden, 행동 줄이 머리띠 밑으로 지나가면 표시, 다시 들어오면 hidden', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    expect(bar()).not.toBeNull();
    expect(bar()).toHaveAttribute('hidden');

    reportActions(false, 40);
    expect(bar()).not.toHaveAttribute('hidden');

    reportActions(true, 300);
    expect(bar()).toHaveAttribute('hidden');
    // 아래쪽으로 벗어난 경우(행동 줄이 아직 화면 아래)는 표시하지 않는다
    reportActions(false, 900);
    expect(bar()).toHaveAttribute('hidden');
  });

  it('IO rootMargin 위쪽은 머리띠 높이만큼 음수다', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    await waitFor(() => expect(actionsObserver()?.options?.rootMargin).toBe(`-${HEADER_H}px 0px 0px 0px`));
  });

  it('넓은 화면(>640)은 바도 이동 줄도 없다', async () => {
    width = 1024;
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    expect(bar()).toBeNull();
    expect(document.querySelector('.place-jump')).toBeNull();
  });

  it('IntersectionObserver 가 없으면 바를 그리지 않는다', async () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    expect(bar()).toBeNull();
  });

  it('허브(PlacePage) 화면에는 바가 없다 — 상세 전용 :has 범위의 전제', async () => {
    vi.mocked(fetchAdministrativeRegions).mockResolvedValue([]);
    vi.mocked(suggestPlaces).mockResolvedValue([]);
    vi.mocked(searchAttractions).mockResolvedValue({ searchId: 's', attractions: [base], totalElements: 1, totalPages: 1, currentPage: 0 });
    renderAt('/place');
    await screen.findByText('경복궁');
    expect(bar()).toBeNull();
  });
});

describe('하단 행동 바 — 칸', () => {
  it('전화가 있으면 넷(길찾기·찜·공유·전화), 길찾기 주소는 행동 줄과 같다', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    reportActions(false, 40);
    const group = screen.getByRole('group', { name: '이 관광지 바로 하기' });
    expect(group).toBe(bar());
    const cells = Array.from(group.querySelectorAll(':scope > .place-action-bar__cell'));
    expect(cells).toHaveLength(4);
    const dir = within(group).getByRole('link', { name: '길찾기' });
    expect(dir).toHaveAttribute('href', googleMapsDirectionsUrl(base));
    const rowDir = within(document.querySelector('.place-detail-actions') as HTMLElement).getByRole('link', { name: '길찾기' });
    expect(dir.getAttribute('href')).toBe(rowDir.getAttribute('href'));
    expect(within(group).getByRole('button', { name: '관광지 찜' })).toBeInTheDocument();
    expect(within(group).getByRole('link', { name: '전화' })).toHaveAttribute('href', 'tel:0237003900');
  });

  it('전화가 없으면 세 칸이다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({ ...base, tel: null, infoCenter: null });
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    reportActions(false, 40);
    expect(bar()!.querySelectorAll(':scope > .place-action-bar__cell')).toHaveLength(3);
    expect(within(bar()!).queryByRole('link', { name: '전화' })).toBeNull();
  });

  it('공유 칸 — navigator.share 가 있으면 「공유」, 없으면 「링크 복사」 하나', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    reportActions(false, 40);
    expect(within(bar()!).getByRole('button', { name: '링크 복사' })).toBeInTheDocument();
    expect(within(bar()!).queryByRole('button', { name: '공유' })).toBeNull();
    cleanup();

    Object.defineProperty(navigator, 'share', { value: vi.fn().mockResolvedValue(undefined), configurable: true });
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    reportActions(false, 40);
    expect(within(bar()!).getByRole('button', { name: '공유' })).toBeInTheDocument();
    expect(within(bar()!).queryByRole('button', { name: '링크 복사' })).toBeNull();
  });

  it('찜 — 바의 별을 누르면 제목 옆 별의 aria-pressed 도 바뀐다', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    reportActions(false, 40);
    const titleStar = document.querySelector('.favorite-title-row .favorite-btn')!;
    expect(titleStar).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(within(bar()!).getByRole('button', { name: '관광지 찜' }));
    await waitFor(() => expect(titleStar).toHaveAttribute('aria-pressed', 'true'));
    expect(bar()!.querySelector('.favorite-btn')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('하단 행동 바 · 행동 줄 — 계측(실제 트래커 대기열)', () => {
  it('바 길찾기 → DIRECTIONS + source action_bar', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    reportActions(false, 40);
    fireEvent.click(within(bar()!).getByRole('link', { name: '길찾기' }));
    expect(clicks().filter((e) => e.sectionId === 'DIRECTIONS').map((e) => e.payload)).toEqual([
      { kind: 'google_maps_directions', source: 'action_bar' },
    ]);
  });

  it('같은 view 에서 행동 줄 길찾기 뒤 바 길찾기는 한 건(첫 위치)만 남는다', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    reportActions(false, 40);
    const row = document.querySelector('.place-detail-actions') as HTMLElement;
    fireEvent.click(within(row).getByRole('link', { name: '길찾기' }));
    fireEvent.click(within(bar()!).getByRole('link', { name: '길찾기' }));
    expect(clicks().filter((e) => e.sectionId === 'DIRECTIONS').map((e) => e.payload)).toEqual([
      { kind: 'google_maps_directions' },
    ]);
  });

  it('바 공유 → SHARE + channel·source', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    reportActions(false, 40);
    fireEvent.click(within(bar()!).getByRole('button', { name: '링크 복사' }));
    expect(clicks().filter((e) => e.sectionId === 'SHARE').map((e) => e.payload)).toEqual([
      { kind: 'attraction', channel: 'copy', source: 'action_bar' },
    ]);
  });

  it('전화 — 행동 줄은 PHONE(payload 없음), 다른 view 에서 바 전화는 PHONE + source', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    const row = document.querySelector('.place-detail-actions') as HTMLElement;
    fireEvent.click(within(row).getByRole('link', { name: '02-3700-3900' }));
    const phone = clicks().filter((e) => e.sectionId === 'PHONE');
    expect(phone).toHaveLength(1);
    expect(phone[0]).toMatchObject({ entityId: '100', screenType: 'ATTRACTION_DETAIL', screenRef: '100' });
    expect(phone[0].payload).toBeUndefined();
    cleanup();
    resetTrackerForTest();

    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    reportActions(false, 40);
    fireEvent.click(within(bar()!).getByRole('link', { name: '전화' }));
    expect(clicks().filter((e) => e.sectionId === 'PHONE').map((e) => e.payload)).toEqual([{ source: 'action_bar' }]);
  });
});

describe('절 이동 줄 (≤640px)', () => {
  const jump = () => screen.getByRole('navigation', { name: '이 페이지 안에서 이동' });

  it('있는 절만 이 순서로 링크한다 — 방문 정보는 정보 탭 묶음(aria-label 있음)이 대상', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    const links = within(jump()).getAllByRole('link');
    expect(links.map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['요약', '#place-sec-summary'],
      ['가는 법', '#place-sec-access'],
      ['방문 정보', '#place-sec-info'],
      ['주변', '#place-sec-nearby'],
    ]);
    const info = document.getElementById('place-sec-info')!;
    expect(info).toHaveClass('place-info-tabs');
    expect(info).toHaveAttribute('aria-label', '방문 정보');
    expect(info).toHaveAttribute('tabindex', '-1');
    expect(document.getElementById('place-sec-summary')).toHaveClass('place-visit');
    expect(document.getElementById('place-sec-access')).toHaveClass('place-access');
    // 이동 줄은 첫 화면 묶음 바로 뒤
    expect(document.querySelector('.place-detail-first')!.nextElementSibling).toBe(jump());
  });

  it('클릭하면 그 절로 포커스가 옮겨지고 주소에 해시가 생기지 않는다 · SECTION_JUMP 는 view 당 첫 건만', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    fireEvent.click(within(jump()).getByRole('link', { name: '가는 법' }));
    const access = document.getElementById('place-sec-access')!;
    expect(document.activeElement).toBe(access);
    expect(access.scrollIntoView).toHaveBeenCalled();
    expect(screen.getByTestId('loc').textContent).toBe('/attractions/100');
    expect(window.location.hash).toBe('');

    fireEvent.click(within(jump()).getByRole('link', { name: '요약' }));
    expect(document.activeElement).toBe(document.getElementById('place-sec-summary'));
    expect(clicks().filter((e) => e.sectionId === 'SECTION_JUMP').map((e) => e.payload)).toEqual([{ target: 'access' }]);
  });

  it('대상이 DOM 에 없으면(주변 목록이 비어 절이 없음) 클릭이 아무것도 하지 않는다', async () => {
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    const before = document.activeElement;
    expect(document.getElementById('place-sec-nearby')).toBeNull();
    fireEvent.click(within(jump()).getByRole('link', { name: '주변' }));
    expect(document.activeElement).toBe(before);
    expect(clicks().filter((e) => e.sectionId === 'SECTION_JUMP')).toHaveLength(0);
  });

  it('링크가 둘 미만이면 줄을 그리지 않는다', async () => {
    vi.mocked(fetchAttraction).mockResolvedValue({
      ...base, access: null, address: null, closureState: null, closedWeekdays: null, attrParking: null, attrAdmission: null,
      useTime: null, tel: null, latitude: null as unknown as number, longitude: null as unknown as number, sidoCode: null,
    });
    renderAt();
    await screen.findByRole('heading', { level: 1, name: '경복궁' });
    expect(document.querySelector('.place-jump')).toBeNull();
  });
});
